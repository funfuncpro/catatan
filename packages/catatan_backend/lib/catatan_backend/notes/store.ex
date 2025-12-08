defmodule CatatanBackend.Notes.Store do
  @moduledoc """
  Internal module responsible for storing and retrieving notes from the database.

  Uses YATA CRDT for collaborative text editing with character-level operations.
  """

  alias CatatanBackend.CassandraClient
  alias CatatanBackend.Notes.Crdt.{Yata, Element}
  alias CatatanBackend.Notes.Crdt.Store, as: YataStore

  @doc """
  Creates a new note with metadata.

  ## Parameters
    - note_id: The unique identifier for the note
    - owner_id: Optional owner identifier (nullable)

  ## Returns
    - `{:ok, metadata}` on success
    - `{:error, reason}` on failure
  """
  @spec create(String.t(), String.t() | nil) :: {:ok, map()} | {:error, term()}
  def create(note_id, owner_id \\ nil) do
    now = DateTime.utc_now()

    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes (id, owner_id, created_at) VALUES (:id, :owner_id, :created_at)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "id" => note_id,
             "owner_id" => owner_id,
             "created_at" => now
           }) do
      {:ok, %{"id" => note_id, "owner_id" => owner_id, "created_at" => now}}
    else
      {:error, reason} -> {:error, {:cassandra, reason}}
    end
  rescue
    exception -> {:error, {:exception, exception}}
  end

  @doc """
  Retrieves note metadata by ID.

  ## Returns
    - `{:ok, metadata}` on success
    - `{:error, :not_found}` if note doesn't exist
    - `{:error, reason}` on failure
  """
  @spec get_metadata(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_metadata(note_id) do
    with {:ok, prepared} <-
           CassandraClient.prepare("SELECT id, owner_id, created_at FROM notes WHERE id = :id"),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(prepared, %{"id" => note_id}) do
      case Enum.to_list(page) do
        [] ->
          {:error, :not_found}

        [row | _] ->
          {:ok,
           %{
             "id" => row["id"],
             "owner_id" => row["owner_id"],
             "created_at" => row["created_at"]
           }}
      end
    else
      {:error, reason} -> {:error, {:cassandra, reason}}
    end
  rescue
    exception -> {:error, {:exception, exception}}
  end

  @doc """
  Loads a complete YATA state for a note by reconstructing from stored elements.

  ## Parameters
    - note_id: The note identifier
    - writer_id: The current writer's identifier

  ## Returns
    - `{:ok, Yata.t()}` with reconstructed state
    - `{:error, reason}` on failure
  """
  @spec get(String.t(), String.t()) :: {:ok, Yata.t()} | {:error, term()}
  def get(note_id, writer_id) do
    with {:ok, elements} <- YataStore.load_elements(note_id),
         {:ok, state_vector} <- YataStore.load_state_vector(note_id) do
      yata = reconstruct_yata(note_id, writer_id, elements, state_vector)
      {:ok, yata}
    end
  end

  @doc """
  Checks if a note exists.
  """
  @spec exists?(String.t()) :: boolean()
  def exists?(note_id) do
    case get_metadata(note_id) do
      {:ok, _} -> true
      _ -> false
    end
  end

  @doc """
  Updates the owner of a note.
  """
  @spec update_owner(String.t(), String.t()) :: {:ok, :updated} | {:error, term()}
  def update_owner(note_id, new_owner_id) do
    query = "UPDATE notes SET owner_id = :owner_id WHERE id = :id"
    params = %{"id" => note_id, "owner_id" => new_owner_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, _result} <- CassandraClient.execute(prepared, params) do
      {:ok, :updated}
    else
      {:error, reason} -> {:error, {:cassandra, reason}}
    end
  end

  defp reconstruct_yata(note_id, writer_id, elements, state_vector) do
    clock = Map.get(state_vector, writer_id, 0)

    elements_map =
      elements
      |> Enum.map(fn element -> {Element.encode_id(element.id), element} end)
      |> Map.new()

    %Yata{
      note_id: note_id,
      writer_id: writer_id,
      clock: clock,
      elements: elements_map,
      state_vector: state_vector
    }
  end
end
