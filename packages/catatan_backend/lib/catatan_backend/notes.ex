defmodule CatatanBackend.Notes do
  @moduledoc """
  Public API for managing notes in the CatatanBackend application.

  This module uses YATA CRDT for collaborative text editing with
  character-level conflict resolution.
  """

  alias CatatanBackend.GenerateID
  alias CatatanBackend.Notes.Store
  alias CatatanBackend.Notes.Crdt.Yata
  alias CatatanBackend.Server.NotesNew

  # --- Storage Operations ---

  @doc """
  Creates a new note.

  Generates a unique nano ID and creates the note metadata.
  The note starts empty - content is added via YATA operations.

  ## Examples

      iex> create_note()
      {:ok, %{"note_id" => "abc123", "owner_id" => nil, "created_at" => ~U[...]}}

      iex> create_note("user123")
      {:ok, %{"note_id" => "abc123", "owner_id" => "user123", "created_at" => ~U[...]}}
  """
  @spec create_note(String.t() | nil) :: {:ok, map()} | {:error, term()}
  def create_note(owner_id \\ nil) do
    note_id = generate_note_id()

    case Store.create(note_id, owner_id) do
      {:ok, metadata} ->
        {:ok,
         %{
           "note_id" => metadata["id"],
           "owner_id" => metadata["owner_id"],
           "created_at" => metadata["created_at"]
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Retrieves a note by its ID.

  Returns the note metadata and current content reconstructed from YATA elements.
  """
  @spec get_note_by_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_note_by_id(note_id) do
    writer_id = get_replica_id()

    with {:ok, metadata} <- Store.get_metadata(note_id),
         {:ok, yata} <- Store.get(note_id, writer_id) do
      {:ok,
       %{
         "note_id" => metadata["id"],
         "owner_id" => metadata["owner_id"],
         "created_at" => metadata["created_at"],
         "content" => Yata.to_text(yata)
       }}
    end
  end

  @doc """
  Checks if a note exists.
  """
  @spec note_exists?(String.t()) :: boolean()
  def note_exists?(note_id) do
    Store.exists?(note_id)
  end

  # --- Live/Realtime Operations (YATA CRDT-based) ---

  @doc """
  Returns the full YATA state for a note.
  """
  @spec get_state(String.t()) :: {:ok, Yata.t()}
  def get_state(note_id) do
    NotesNew.get_state(note_id)
  end

  @doc """
  Returns the document text content.
  """
  @spec get_text(String.t()) :: {:ok, String.t()}
  def get_text(note_id) do
    NotesNew.get_text(note_id)
  end

  @spec generate_note_id() :: String.t()
  defp generate_note_id, do: GenerateID.generate_nano_id()

  @spec get_replica_id() :: String.t()
  defp get_replica_id do
    Application.get_env(:catatan_backend, CatatanBackend.Replica)[:replica_id]
  end
end
