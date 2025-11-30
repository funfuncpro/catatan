defmodule CatatanBackendWeb.Channels.Notes do
  use Phoenix.Channel
  require Logger
  alias CatatanBackend.Server.NotesSession
  alias CatatanBackend.Server.NotesNew
  alias CatatanBackend.Notes.Crdt.Element
  alias CatatanBackendWeb.NotesValidator

  @impl true
  def join("notes:" <> notes_id, _payload, socket) do
    with {:ok, validated_id} <- NotesValidator.validate_note_id(notes_id),
         :ok <- ensure_session_started(validated_id),
         :ok <- ensure_crdt_started(validated_id),
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

  @impl true
  def handle_in(
        "insert",
        %{"origin" => origin, "right_origin" => right_origin, "content" => content},
        socket
      ) do
    writer_id = socket.assigns.writer_id
    notes_id = socket.assigns.notes_id

    parsed_origin = parse_element_id(origin)
    parsed_right_origin = parse_element_id(right_origin)

    case NotesNew.insert(notes_id, parsed_origin, parsed_right_origin, content, writer_id) do
      {:ok, element} ->
        {:reply, {:ok, %{element: serialize_element(element)}}, socket}

      {:error, reason} ->
        Logger.error("Insert failed: #{inspect(reason)}")
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("delete", %{"element_id" => element_id}, socket) do
    notes_id = socket.assigns.notes_id

    case NotesNew.delete(notes_id, element_id) do
      {:ok, _element} ->
        {:reply, :ok, socket}

      {:error, :not_found} ->
        {:reply, {:error, %{reason: "not_found"}}, socket}

      {:error, reason} ->
        Logger.error("Delete failed: #{inspect(reason)}")
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("sync", %{"state_vector" => client_sv}, socket) do
    notes_id = socket.assigns.notes_id

    case NotesNew.get_delta(notes_id, client_sv) do
      {:ok, elements} ->
        {:reply, {:ok, %{elements: Enum.map(elements, &serialize_element/1)}}, socket}

      {:error, reason} ->
        Logger.error("Sync failed: #{inspect(reason)}")
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("get_text", _payload, socket) do
    notes_id = socket.assigns.notes_id

    case NotesNew.get_text(notes_id) do
      {:ok, text} ->
        {:reply, {:ok, %{text: text}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_info({:presence_state, payload}, socket) do
    push(socket, "presence_state", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info({:crdt_operation, {:insert, element}}, socket) do
    push(socket, "remote_insert", %{element: serialize_element(element)})
    {:noreply, socket}
  end

  @impl true
  def handle_info({:crdt_operation, {:delete, element_id, deleted_at}}, socket) do
    push(socket, "remote_delete", %{
      element_id: element_id,
      deleted_at: DateTime.to_iso8601(deleted_at)
    })

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

  # --- Private Functions ---

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

  defp ensure_crdt_started(note_id) do
    case DynamicSupervisor.start_child(
           CatatanBackend.NotesCrdtSupervisor,
           {CatatanBackend.Server.NotesNew, note_id}
         ) do
      {:ok, _pid} ->
        :ok

      {:error, {:already_started, _pid}} ->
        :ok

      {:error, reason} = error ->
        Logger.error("Failed to start CRDT server: #{inspect(reason)}")
        error
    end
  end

  defp parse_element_id(nil), do: nil

  defp parse_element_id([writer_id, clock]) when is_binary(writer_id) and is_integer(clock) do
    {writer_id, clock}
  end

  defp parse_element_id(_), do: nil

  defp serialize_element(%Element{} = el) do
    %{
      id: serialize_id(el.id),
      origin: serialize_id(el.origin),
      right_origin: serialize_id(el.right_origin),
      content: el.content,
      deleted_at: el.deleted_at
    }
  end

  defp serialize_id(nil), do: nil
  defp serialize_id({writer_id, clock}), do: [writer_id, clock]
end
