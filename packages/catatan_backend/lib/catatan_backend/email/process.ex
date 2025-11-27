defmodule CatatanBackend.Email.Process do
  @moduledoc """
  This module is for processing email messages consumed from the SQS poller.
  """

  use GenStage
  import Swoosh.Email

  require Logger

  alias ExAws.SQS
  alias CatatanBackend.Email.Templates
  alias CatatanBackend.SESMailer

  @spec start_link(%{
          queue_url: String.t()
        }) :: term()
  def start_link(opts), do: GenStage.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  @spec init(%{queue_url: String.t()}) :: {:consumer}
  def init(opts) do
    {:consumer, opts,
     subscribe_to: [{CatatanBackend.Email.SQSPoller, max_demand: 10, min_demand: 1}]}
  end

  @impl true
  def handle_events(events, _from, %{queue_url: queue_url} = state) do
    Enum.each(events, fn event ->
      process_event(event, queue_url)
    end)

    {:noreply, [], state}
  end

  defp process_event(%{data: payload, receipt_handle: receipt_handle}, queue_url) do
    with {:ok, %{to: to, subject: subject, type: type, data: data}} <- normalize_payload(payload),
         {:ok, %{html: html, text: text}} <- Templates.render(type, data),
         {:ok, _response} <- deliver_email(to, subject, html, text) do
      delete_message(queue_url, receipt_handle)
    else
      {:error, reason} ->
        Logger.error("Failed to process email payload: #{inspect(reason)}")
    end
  end

  defp process_event(unexpected_event, _queue_url) do
    Logger.error("Unexpected email event: #{inspect(unexpected_event)}")
  end

  defp deliver_email(to, subject, html_body_content, text_body_content) do
    from_email =
      Application.get_env(:catatan_backend, CatatanBackend.MailerInformation)[:from_email]

    new()
    |> to(to)
    |> from(from_email)
    |> subject(subject)
    |> html_body(html_body_content)
    |> text_body(text_body_content)
    |> SESMailer.deliver()
  end

  defp delete_message(queue_url, receipt_handle) do
    case queue_url
         |> SQS.delete_message(receipt_handle)
         |> ExAws.request() do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.warning(
          "Failed to delete SQS message (receipt_handle: #{receipt_handle}): #{inspect(reason)}"
        )

        :ok
    end
  end

  defp normalize_payload(%{"to" => to, "subject" => subject, "type" => "registration"} = payload)
       when is_binary(to) and is_binary(subject) do
    {:ok,
     %{
       to: to,
       subject: subject,
       type: :registration,
       data: atomize_keys(Map.get(payload, "data", %{}))
     }}
  end

  defp normalize_payload(%{to: to, subject: subject, type: type} = payload)
       when is_binary(to) and is_binary(subject) and is_atom(type) do
    {:ok,
     %{
       to: to,
       subject: subject,
       type: type,
       data: Map.get(payload, :data, %{})
     }}
  end

  defp normalize_payload(payload) do
    {:error, {:invalid_payload, payload}}
  end

  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {key, value} when is_binary(key) -> {String.to_atom(key), value}
      {key, value} -> {key, value}
    end)
  end
end
