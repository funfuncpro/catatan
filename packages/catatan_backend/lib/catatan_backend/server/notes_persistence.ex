defmodule CatatanBackend.Server.NotesPersistence do
  @moduledoc """
  Async persistence worker for CRDT operations.
  Receives casts from NotesNew and writes to Cassandra without blocking.

  This decouples real-time collaboration (handled by NotesNew) from
  durable storage, ensuring immediate response times for clients.
  """
  use GenServer
  require Logger
  alias CatatanBackend.Notes.Crdt.Store

  @spec start_link(String.t()) :: GenServer.on_start()
  def start_link(note_id) do
    GenServer.start_link(__MODULE__, note_id, name: via_tuple(note_id))
  end

  @doc """
  Asynchronously saves an element to Cassandra.
  Fire-and-forget - does not block the caller.
  """
  @spec save_element(String.t(), map()) :: :ok
  def save_element(note_id, element) do
    GenServer.cast(via_tuple(note_id), {:save_element, element})
  end

  @doc """
  Asynchronously marks an element as deleted in Cassandra.
  Fire-and-forget - does not block the caller.
  """
  @spec mark_deleted(String.t(), String.t(), DateTime.t()) :: :ok
  def mark_deleted(note_id, element_id, deleted_at) do
    GenServer.cast(via_tuple(note_id), {:mark_deleted, element_id, deleted_at})
  end

  @doc """
  Asynchronously marks multiple elements as deleted in Cassandra.
  Fire-and-forget - does not block the caller.
  """
  @spec mark_deleted_batch(String.t(), [String.t()], DateTime.t()) :: :ok
  def mark_deleted_batch(note_id, element_ids, deleted_at) do
    GenServer.cast(via_tuple(note_id), {:mark_deleted_batch, element_ids, deleted_at})
  end

  # --- Server Callbacks ---

  @impl true
  def init(note_id) do
    Logger.info("Starting persistence worker for note #{note_id}")
    {:ok, %{note_id: note_id}}
  end

  @impl true
  def handle_cast({:save_element, element}, state) do
    case Store.save_element(element) do
      :ok ->
        :ok

      {:error, reason} ->
        Logger.error(
          "Async save failed for note #{state.note_id}, element #{inspect(element.id)}: #{inspect(reason)}"
        )

        # TODO: Could add retry logic or dead-letter queue here for recovery
    end

    {:noreply, state}
  end

  @impl true
  def handle_cast({:mark_deleted, element_id, deleted_at}, state) do
    case Store.mark_deleted(state.note_id, element_id, deleted_at) do
      :ok ->
        :ok

      {:error, reason} ->
        Logger.error(
          "Async delete failed for note #{state.note_id}, element #{element_id}: #{inspect(reason)}"
        )

        # TODO: Could add retry logic or dead-letter queue here for recovery
    end

    {:noreply, state}
  end

  @impl true
  def handle_cast({:mark_deleted_batch, element_ids, deleted_at}, state) do
    Enum.each(element_ids, fn element_id ->
      case Store.mark_deleted(state.note_id, element_id, deleted_at) do
        :ok ->
          :ok

        {:error, reason} ->
          Logger.error(
            "Async batch delete failed for note #{state.note_id}, element #{element_id}: #{inspect(reason)}"
          )
      end
    end)

    {:noreply, state}
  end

  defp via_tuple(note_id) do
    {:via, Registry, {CatatanBackend.Registry, "persistence_#{note_id}"}}
  end
end
