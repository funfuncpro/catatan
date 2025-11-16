defmodule CatatanBackend.Notes do
  @moduledoc """
  Public API for managing notes in the CatatanBackend application.

  This module provides two paths for note operations:
  1. Persistent storage (Cassandra) - for CRUD operations
  2. Live/realtime (GenServer + CRDT) - for collaborative editing
  """

  alias CatatanBackend.GenerateID
  alias CatatanBackend.Notes.{Create, Update, Get, All}
  alias CatatanBackend.Server.Notes, as: NoteServer

  # --- Persistent Storage Operations ---

  @doc """
  Creates a new note with the given content.

  Generates a unique nano ID and timestamp, then persists the note to storage.

  ## Examples

      iex> create_note("My note content")
      {:ok, %{note_id: "abc123", content: "My note content", ...}}
  """
  @spec create_note(String.t()) :: {:ok, map()} | {:error, term()}
  def create_note(content) do
    Create.insert_created_note(
      content,
      generate_note_id(),
      current_timestamp()
    )
  end

  @doc """
  Updates an existing note with new content via persistent storage.

  For realtime collaborative updates, use `update_note_live/2` instead.
  """
  @spec update_note_by_id(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def update_note_by_id(note_id, new_content) do
    Update.update_note(note_id, new_content)
  end

  @doc """
  Retrieves a note by its ID from persistent storage.
  """
  @spec get_note_by_id(String.t()) :: {:ok, map()} | {:error, :not_found}
  def get_note_by_id(note_id) do
    Get.by_id(note_id)
  end

  @doc """
  Retrieves all notes from persistent storage.
  """
  @spec list_notes() :: {:ok, list(map())} | {:error, term()}
  def list_notes do
    All.all()
  end

  # --- Live/Realtime Operations (CRDT-based) ---

  @doc """
  Opens a note for realtime editing and returns the current body.

  This ensures the NoteServer GenServer is started for the given note
  and retrieves the current markdown body from memory. This is the entry
  point for collaborative editing sessions.

  ## Examples

      iex> open_note_live("note123")
      {:ok, "Current note content"}
  """
  @spec open_note_live(String.t()) :: {:ok, String.t()}
  def open_note_live(note_id) do
    note_id
    |> ensure_note_started()
    |> read_note_body()
  end

  @doc """
  Updates a note's content through the realtime CRDT path.

  This broadcasts changes to all connected clients and persists
  asynchronously to Cassandra. Use this for collaborative editing.

  ## Examples

      iex> update_note_live("note123", "Updated content")
      :ok
  """
  @spec update_note_live(String.t(), String.t()) :: :ok
  def update_note_live(note_id, markdown) do
    NoteServer.set_body(note_id, markdown)
  end

  @doc """
  Reads the current live content from memory (GenServer state).

  This bypasses storage and reads directly from the CRDT state.
  """
  @spec get_live_body(String.t()) :: String.t()
  def get_live_body(note_id) do
    NoteServer.read_body(note_id)
  end

  @spec ensure_note_started(String.t()) :: String.t()
  defp ensure_note_started(note_id) do
    :ok = NoteServer.ensure_started(note_id)
    note_id
  end

  @spec read_note_body(String.t()) :: {:ok, String.t()}
  defp read_note_body(note_id) do
    note_id
    |> NoteServer.read_body()
    |> then(&{:ok, &1})
  end

  @spec generate_note_id() :: String.t()
  defp generate_note_id, do: GenerateID.generate_nano_id()

  @spec current_timestamp() :: integer()
  defp current_timestamp do
    DateTime.utc_now() |> DateTime.to_unix(:millisecond)
  end
end
