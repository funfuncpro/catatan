defmodule CatatanBackendWeb.NoteChannel do
  use Phoenix.Channel
  require Logger

  alias CatatanBackend.Server.Notes, as: NoteServer
  alias CatatanBackendWeb.NotesValidator
  alias CatatanBackend.Shares

  @impl true
  def join("note:" <> note_id, payload, socket) do
    # Check if this is a share-based join
    share_id = Map.get(payload, "share_id")

    with {:ok, validated_id} <- NotesValidator.validate_note_id(note_id),
         {:ok, permission_level} <- get_permission_level(share_id, validated_id),
         :ok <- NoteServer.ensure_started(validated_id),
         :ok <- Phoenix.PubSub.subscribe(CatatanBackend.PubSub, "note:" <> validated_id) do
      body = NoteServer.read_body(validated_id)

      socket = socket
        |> assign(:note_id, validated_id)
        |> assign(:permission_level, permission_level)
        |> assign(:share_id, share_id)

      Logger.info("Client joined note channel: #{validated_id} with permission: #{permission_level}")
      {:ok, %{"body" => body, "permission_level" => permission_level}, socket}
    else
      {:error, errors} ->
        Logger.warning("Failed to join note channel: #{note_id}, errors: #{inspect(errors)}")
        {:error, %{reason: "invalid_note_id", details: errors}}

      error ->
        Logger.error("Unexpected error joining note channel: #{inspect(error)}")
        {:error, %{reason: "internal_error"}}
    end
  rescue
    exception ->
      Logger.error("Exception in join: #{inspect(exception)}")
      {:error, %{reason: "internal_error"}}
  end

  @impl true
  def handle_in("set_body", payload, socket) do
    note_id = socket.assigns.note_id
    permission_level = Map.get(socket.assigns, :permission_level, "read")

    # Check write permission
    case permission_level do
      "write" ->
        with {:ok, %{body: markdown}} <- NotesValidator.validate_set_body(payload),
             :ok <- NoteServer.set_body(note_id, markdown) do
          {:reply, {:ok, %{success: true}}, socket}
        else
          {:error, {:persist_failed, reason}} ->
            Logger.error("Failed to persist note #{note_id}: #{inspect(reason)}")
            {:reply, {:error, %{reason: "persistence_failed"}}, socket}

          {:error, errors} ->
            {:reply, {:error, %{reason: "validation_failed", details: errors}}, socket}

          error ->
            Logger.error("Unexpected error in set_body: #{inspect(error)}")
            {:reply, {:error, %{reason: "internal_error"}}, socket}
        end

      "read" ->
        Logger.warning("Attempted write on read-only share: #{socket.assigns[:share_id]}")
        {:reply, {:error, %{reason: "permission_denied", message: "This is a read-only share"}}, socket}

      _ ->
        {:reply, {:error, %{reason: "invalid_permission"}}, socket}
    end
  rescue
    exception ->
      Logger.error("Exception in handle_in set_body: #{inspect(exception)}")
      {:reply, {:error, %{reason: "internal_error"}}, socket}
  end

  @impl true
  def handle_in(_event, _payload, socket) do
    {:reply, {:error, %{reason: "unknown_event"}}, socket}
  end

  @impl true
  def handle_info({:note_updated, %{body: body, clock: clock}}, socket) do
    push(socket, "note_updated", %{"body" => body, "clock" => clock})
    {:noreply, socket}
  end

  # Helper function to determine permission level
  defp get_permission_level(nil, _note_id) do
    # No share_id means direct access (full write access)
    {:ok, "write"}
  end

  defp get_permission_level(share_id, _note_id) do
    case Shares.Get.get_permission_level(share_id) do
      {:ok, level} -> {:ok, level}
      {:error, _} -> {:ok, "read"}  # Default to read-only on error
    end
  end

  @impl true
  def terminate(reason, socket) do
    note_id = Map.get(socket.assigns, :note_id)
    Logger.info("Channel terminated for note: #{note_id}, reason: #{inspect(reason)}")
    :ok
  end
end
