defmodule CatatanBackendWeb.Channels.Notes do
  use Phoenix.Channel
  require Logger
  alias CatatanBackend.Server.NotesSession
  alias CatatanBackendWeb.NotesValidator

  @impl true
  def join("notes:" <> notes_id, _payload, socket) do
    with {:ok, validated_id} <- NotesValidator.validate_note_id(notes_id),
         :ok <- ensure_session_started(validated_id),
         {:ok, my_writer, all_writers} <-
           NotesSession.join(validated_id, nil) do
      Phoenix.PubSub.subscribe(CatatanBackend.PubSub, "notes:" <> validated_id)

      socket =
        socket
        |> assign(:notes_id, validated_id)
        |> assign(:writer_id, my_writer.id)
        |> assign(:current_writers, all_writers)

      {:ok, %{my_writer_id: my_writer.id, writers: all_writers}, socket}
    else
      {:error, errors} ->
        Logger.warning("Failed to join note channel: #{notes_id}, errors: #{inspect(errors)}")
        {:error, %{reason: "invalid_note_id", details: errors}}
    end
  rescue
    exception ->
      Logger.error("Exception in join: #{inspect(exception)}\n#{Exception.format_stacktrace()}")
      {:error, %{reason: "internal_error"}}
  end

  @impl true
  def handle_in("cursor_move", %{"x" => x, "y" => y}, socket) do
    writer_id = socket.assigns.writer_id
    notes_id = socket.assigns.notes_id
    NotesSession.update_cursor(notes_id, writer_id, x, y)
    {:noreply, socket}
  end

  # @impl true
  # def handle_in("update_body", %{"body" => body}, socket) do
  #   notes_id = socket.assigns.notes_id

  #   case Notes.set_body(notes_id, body) do
  #     :ok -> {:reply, :ok, socket}
  #     {:error, reason} -> {:reply, {:error, %{reason: inspect(reason)}}, socket}
  #   end
  # end

  # @impl true
  # def handle_info({:note_updated, %{body: body, clock: clock}}, socket) do
  #   push(socket, "note_updated", %{body: body, clock: clock})
  #   {:noreply, socket}
  # end

  @impl true
  def handle_info({:presence_state, payload}, socket) do
    push(socket, "presence_state", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, _pid, _reason}, socket) do
    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    with notes_id when not is_nil(notes_id) <- socket.assigns[:notes_id],
         writer_id when not is_nil(writer_id) <- socket.assigns[:writer_id] do
      NotesSession.leave(notes_id, writer_id)
    end

    :ok
  end

  defp ensure_session_started(note_id) do
    case DynamicSupervisor.start_child(
           CatatanBackend.NotesSessionSupervisor,
           {CatatanBackend.Server.NotesSession, note_id}
         ) do
      {:ok, _pid} ->
        :ok

      {:error, {:already_started, _pid}} ->
        :ok

      {:error, reason} = error ->
        Logger.error("Failed to start session: #{inspect(reason)}")
        error
    end
  end
end
