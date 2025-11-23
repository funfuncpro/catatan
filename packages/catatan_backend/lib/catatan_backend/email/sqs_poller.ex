defmodule CatatanBackend.Email.SQSPoller do
  require Logger

  use GenStage

  alias ExAws.SQS

  @prefetch 10
  @max_sqs_receive 10

  def start_link(opts), do: GenStage.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(%{queue_url: _queue_url} = opts) do
    Logger.info("Starting SQS Poller")
    {:producer, %{queue_url: opts.queue_url, buffer: :queue.new(), demand: 0}}
  end

  @impl true
  def handle_demand(
        incoming_demand,
        %{queue_url: queue_url, buffer: buffer, demand: demand} = _state
      ) do
    new_total_demand = demand + incoming_demand
    dispatch_events(queue_url, buffer, new_total_demand)
  end

  @impl true
  def handle_info(:poll_retry, %{queue_url: queue_url, buffer: buffer, demand: demand} = _state) do
    if demand > 0 do
      dispatch_events(queue_url, buffer, demand)
    else
      {:noreply, [], %{queue_url: queue_url, buffer: buffer, demand: demand}}
    end
  end

  defp dispatch_events(queue_url, buffer, demand) do
    {buffered_events, remaining_buffer} = dequeue_events(buffer, demand, [])
    pending_demand = demand - length(buffered_events)

    {new_events, overflow, final_demand} =
      if pending_demand > 0 do
        fetch_count = min(max(@prefetch, pending_demand), @max_sqs_receive)
        fetched = poll_from_sqs(queue_url, fetch_count)

        if length(fetched) == 0 do
          Process.send_after(self(), :poll_retry, 1_000)
          {[], [], pending_demand}
        else
          # Messages found - process normally
          Logger.info("Received #{length(fetched)} messages from SQS")
          {to_send, extra} = Enum.split(fetched, pending_demand)
          {to_send, extra, 0}
        end
      else
        {[], [], 0}
      end

    new_buffer = Enum.reduce(overflow, remaining_buffer, &:queue.in(&1, &2))

    {:noreply, buffered_events ++ new_events,
     %{queue_url: queue_url, buffer: new_buffer, demand: final_demand}}
  end

  defp dequeue_events(queue, 0, acc), do: {Enum.reverse(acc), queue}

  defp dequeue_events(queue, n, acc) do
    case :queue.out(queue) do
      {{:value, item}, new_queue} ->
        dequeue_events(new_queue, n - 1, [item | acc])

      {:empty, _} ->
        {Enum.reverse(acc), queue}
    end
  end

  defp poll_from_sqs(queue_url, limit) do
    case queue_url
         |> SQS.receive_message(max_number_of_messages: limit, wait_time_seconds: 10)
         |> ExAws.request() do
      {:ok, %{body: %{messages: messages}} = _response} ->
        Logger.info("Found #{length(messages)} messages in SQS")

        Enum.reduce(messages, [], fn message, acc ->
          case Jason.decode(message.body) do
            {:ok, body} ->
              [%{data: body, receipt_handle: message.receipt_handle} | acc]

            {:error, reason} ->
              Logger.warning("Failed to decode message: #{inspect(reason)}")
              acc
          end
        end)
        |> Enum.reverse()

      {:ok, _response} ->
        []

      {:error, reason} ->
        Logger.error("Failed to poll SQS: #{inspect(reason)}")
        []
    end
  end
end
