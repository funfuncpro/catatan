defmodule CatatanBackend.Notes do
  @moduledoc """
  Public API for managing notes in the CatatanBackend application.

  This module uses a unified CRDT-based architecture where all notes are stored
  in the notes_lww table with Last-Write-Wins conflict resolution.
  """

  alias CatatanBackend.GenerateID
  alias CatatanBackend.Notes.{Store, NoteCrdt}
  alias CatatanBackend.Server.Notes, as: NoteServer

  # --- Storage Operations ---

  @doc """
  Creates a new note with the given initial content.

  Generates a unique nano ID and creates the first replica with clock=1.

  ## Examples

      iex> create_note("My note content")
      {:ok, %{note_id: "abc123", content: "My note content", clock: 1}}
  """
  @spec create_note(String.t()) :: {:ok, map()} | {:error, term()}
  def create_note(content) do
    note_id = generate_note_id()
    replica_id = get_replica_id()
    initial_clock = 1

    case Store.upsert(note_id, replica_id, initial_clock, content) do
      {:ok, _note} ->
        {:ok,
         %{
           "note_id" => note_id,
           "content" => content,
           "clock" => initial_clock,
           "replica_id" => replica_id
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Retrieves a note by its ID, merging all replicas.

  Returns the merged content from all replicas using LWW semantics.
  """
  @spec get_note_by_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_note_by_id(note_id) do
    case Store.get(note_id) do
      {:ok, note_crdt} ->
        {:ok,
         %{
           "note_id" => note_crdt.note_id,
           "content" => NoteCrdt.get_body(note_crdt),
           "clock" => NoteCrdt.current_clock(note_crdt)
         }}

      {:error, reason} ->
        {:error, reason}
    end
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

  @spec get_replica_id() :: String.t()
  defp get_replica_id do
    Application.get_env(:catatan_backend, CatatanBackend.Replica)[:replica_id]
  end
end
