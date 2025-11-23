defmodule CatatanBackend.Email.ProducerConsumer do
  @moduledoc """
  This module is for consuming email messages from the email producer.
  """
  use GenStage
  require Logger
  alias ExAws.SQS

  @spec start_link(%{
          queue_url: String.t()
        }) :: term()
  def start_link(opts) do
    GenStage.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  @spec init(%{queue_url: String.t()}) ::
          {:producer_consumer, map(), keyword()}
  def init(opts) do
    {:producer_consumer, opts, subscribe_to: [CatatanBackend.Email.Producer]}
  end

  @impl true
  def handle_events(events, _from, %{queue_url: queue_url} = state) do
    Enum.each(events, fn event ->
      case queue_url
           |> SQS.send_message(Jason.encode!(event))
           |> ExAws.request() do
        {:ok, _} ->
          :ok

        {:error, reason} ->
          Logger.error(
            "Failed to send email to SQS: #{inspect(reason)}, event: #{inspect(event)}"
          )
      end
    end)

    {:noreply, events, state}
  end
end
