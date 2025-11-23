defmodule CatatanBackend.Email.Producer do
  @moduledoc """
  This module is for producing email messages to be consumed by the email consumer.
  """

  use GenStage
  require Logger

  @type template_type :: :registration | String.t()

  @type t :: %__MODULE__{
          to: String.t(),
          subject: String.t(),
          type: template_type(),
          data: map()
        }

  defstruct [:to, :subject, :type, data: %{}]

  @max_queue_size 10_000

  def enqueue(payload), do: GenStage.call(__MODULE__, {:enqueue, payload})
  def enqueue_async(payload), do: GenStage.cast(__MODULE__, {:enqueue, payload})
  def start_link(opts), do: GenStage.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_) do
    {:producer,
     %{
       queue: :queue.new(),
       demand: 0
     }}
  end

  @impl true
  def handle_call({:enqueue, payload}, _from, state) do
    if :queue.len(state.queue) >= @max_queue_size do
      Logger.warning("Email queue is full (#{@max_queue_size} items), rejecting new email")
      {:reply, {:error, :queue_full}, [], state}
    else
      new_state = %{state | queue: :queue.in(payload, state.queue)}
      {events, final_state} = dispatch_event(new_state)
      {:reply, :ok, events, final_state}
    end
  end

  @impl true
  def handle_cast({:enqueue, payload}, state) do
    if :queue.len(state.queue) >= @max_queue_size do
      Logger.warning(
        "Email queue is full (#{@max_queue_size} items), dropping email: #{inspect(payload)}"
      )

      {:noreply, [], state}
    else
      new_state = %{state | queue: :queue.in(payload, state.queue)}
      {events, final_state} = dispatch_event(new_state)
      {:noreply, events, final_state}
    end
  end

  @impl true
  def handle_demand(incoming_demand, state) do
    new_state = update_in(state.demand, &(&1 + incoming_demand))
    {events, final_state} = dispatch_event(new_state)
    {:noreply, events, final_state}
  end

  defp dispatch_event(state), do: dispatch_events_helper(state, [])

  defp dispatch_events_helper(%{demand: 0} = state, acc) do
    {Enum.reverse(acc), state}
  end

  defp dispatch_events_helper(%{queue: queue, demand: demand} = state, acc) do
    case :queue.out(queue) do
      {{:value, event}, new_queue} ->
        dispatch_events_helper(
          %{state | queue: new_queue, demand: demand - 1},
          [event | acc]
        )

      {:empty, _} ->
        {Enum.reverse(acc), state}
    end
  end
end
