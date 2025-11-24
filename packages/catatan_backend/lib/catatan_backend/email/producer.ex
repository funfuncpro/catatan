defmodule CatatanBackend.Email.Producer do
  @moduledoc """
  This module is for sending email messages directly to SQS.
  """

  use GenServer
  require Logger
  alias ExAws.SQS

  @type template_type :: :registration | String.t()

  @type t :: %__MODULE__{
          to: String.t(),
          subject: String.t(),
          type: template_type(),
          data: map()
        }

  defstruct [:to, :subject, :type, data: %{}]

  def enqueue(payload), do: GenServer.call(__MODULE__, {:enqueue, payload})
  def enqueue_async(payload), do: GenServer.cast(__MODULE__, {:enqueue, payload})
  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(opts) do
    {:ok, opts}
  end

  @impl true
  def handle_call({:enqueue, payload}, _from, %{queue_url: queue_url} = state) do
    case send_to_sqs(queue_url, payload) do
      :ok ->
        Logger.info("Email event sent to SQS: #{inspect(payload)}")
        {:reply, :ok, state}

      {:error, reason} = error ->
        Logger.error(
          "Failed to send email to SQS: #{inspect(reason)}, event: #{inspect(payload)}"
        )

        {:reply, error, state}
    end
  end

  @impl true
  def handle_cast({:enqueue, payload}, %{queue_url: queue_url} = state) do
    case send_to_sqs(queue_url, payload) do
      :ok ->
        Logger.info("Email event sent to SQS (async): #{inspect(payload)}")

      {:error, reason} ->
        Logger.error(
          "Failed to send email to SQS (async): #{inspect(reason)}, event: #{inspect(payload)}"
        )
    end

    {:noreply, state}
  end

  defp send_to_sqs(queue_url, payload) do
    encoded_payload = Jason.encode!(payload)

    case queue_url
         |> SQS.send_message(encoded_payload)
         |> ExAws.request() do
      {:ok, _response} ->
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end
end
