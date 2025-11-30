defmodule CatatanBackend.Notes.Crdt.Store.Yata do
  @moduledoc """
  Yata store implementation in Cassandra.

  This module handles persistence of YATA CRDT elements and state vectors
  to Cassandra. It provides functions for:
  - Saving and loading elements (for delta sync)
  - Saving and loading state vectors (to track persisted state)
  """

  alias CatatanBackend.CassandraClient
  alias CatatanBackend.Notes.Crdt.Element

  @type state_vector :: %{String.t() => integer()}

  @doc """
  Saves a list of elements to Cassandra for a given note.

  This is typically called during delta sync to persist new elements.
  Elements are inserted with their full metadata including origin references.

  ## Parameters
    - note_id: The note identifier
    - elements: List of Element structs to save

  ## Returns
    - `:ok` on success
    - `{:error, reason}` on failure
  """
  @spec save_elements(String.t(), [Element.t()]) :: :ok | {:error, term()}
  def save_elements(_note_id, []), do: :ok

  def save_elements(note_id, elements) when is_list(elements) do
    query = """
    INSERT INTO notes_elements (note_id, element_id, origin_id, right_origin_id, content, deleted_at, created_at)
    VALUES (:note_id, :element_id, :origin_id, :right_origin_id, :content, :deleted_at, :created_at)
    """

    with {:ok, prepared} <- CassandraClient.prepare(query) do
      results =
        Enum.map(elements, fn element ->
          params = element_to_params(note_id, element)
          CassandraClient.execute(prepared, params)
        end)

      case Enum.find(results, &match?({:error, _}, &1)) do
        nil -> :ok
        {:error, reason} -> {:error, {:cassandra, reason}}
      end
    else
      {:error, reason} -> {:error, {:cassandra, reason}}
    end
  rescue
    exception -> {:error, {:exception, exception}}
  end

  @doc """
  Loads all elements for a given note from Cassandra.

  This is typically called when initializing a GenServer to reconstruct
  the YATA state from persisted elements.

  ## Parameters
    - note_id: The note identifier

  ## Returns
    - `{:ok, elements}` list of Element structs
    - `{:error, reason}` on failure
  """
  @spec load_elements(String.t()) :: {:ok, [Element.t()]} | {:error, term()}
  def load_elements(note_id) do
    query = """
    SELECT element_id, origin_id, right_origin_id, content, deleted_at
    FROM notes_elements
    WHERE note_id = :note_id
    """

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(prepared, %{"note_id" => note_id}) do
      elements =
        page
        |> Enum.to_list()
        |> Enum.map(&row_to_element/1)

      {:ok, elements}
    else
      {:error, reason} -> {:error, {:cassandra, reason}}
    end
  rescue
    exception -> {:error, {:exception, exception}}
  end

  @doc """
  Saves a state vector to Cassandra for a given note.

  The state vector tracks the highest clock value seen from each writer.
  This is used to determine what elements have been persisted.

  ## Parameters
    - note_id: The note identifier
    - state_vector: Map of writer_id => clock

  ## Returns
    - `:ok` on success
    - `{:error, reason}` on failure
  """
  @spec save_state_vector(String.t(), state_vector()) :: :ok | {:error, term()}
  def save_state_vector(_note_id, state_vector) when state_vector == %{}, do: :ok

  def save_state_vector(note_id, state_vector) when is_map(state_vector) do
    query = """
    INSERT INTO notes_state_vectors (note_id, writer_id, clock, updated_at)
    VALUES (:note_id, :writer_id, :clock, :updated_at)
    """

    with {:ok, prepared} <- CassandraClient.prepare(query) do
      now = DateTime.utc_now()

      results =
        Enum.map(state_vector, fn {writer_id, clock} ->
          params = %{
            "note_id" => note_id,
            "writer_id" => writer_id,
            "clock" => clock,
            "updated_at" => now
          }

          CassandraClient.execute(prepared, params)
        end)

      case Enum.find(results, &match?({:error, _}, &1)) do
        nil -> :ok
        {:error, reason} -> {:error, {:cassandra, reason}}
      end
    else
      {:error, reason} -> {:error, {:cassandra, reason}}
    end
  rescue
    exception -> {:error, {:exception, exception}}
  end

  @doc """
  Loads the state vector for a given note from Cassandra.

  ## Parameters
    - note_id: The note identifier

  ## Returns
    - `{:ok, state_vector}` map of writer_id => clock
    - `{:error, reason}` on failure
  """
  @spec load_state_vector(String.t()) :: {:ok, state_vector()} | {:error, term()}
  def load_state_vector(note_id) do
    query = """
    SELECT writer_id, clock
    FROM notes_state_vectors
    WHERE note_id = :note_id
    """

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(prepared, %{"note_id" => note_id}) do
      state_vector =
        page
        |> Enum.to_list()
        |> Enum.reduce(%{}, fn row, acc ->
          Map.put(acc, row["writer_id"], row["clock"])
        end)

      {:ok, state_vector}
    else
      {:error, reason} -> {:error, {:cassandra, reason}}
    end
  rescue
    exception -> {:error, {:exception, exception}}
  end

  @spec element_to_params(String.t(), Element.t()) :: map()
  defp element_to_params(note_id, %Element{} = element) do
    %{
      "note_id" => note_id,
      "element_id" => Element.encode_id(element.id),
      "origin_id" => Element.encode_id(element.origin),
      "right_origin_id" => Element.encode_id(element.right_origin),
      "content" => element.content,
      "deleted_at" => parse_deleted_at(element.deleted_at),
      "created_at" => DateTime.utc_now()
    }
  end

  @spec row_to_element(map()) :: Element.t()
  defp row_to_element(row) do
    %Element{
      id: Element.decode_id(row["element_id"]),
      origin: Element.decode_id(row["origin_id"]),
      right_origin: Element.decode_id(row["right_origin_id"]),
      content: row["content"],
      deleted_at: format_deleted_at(row["deleted_at"])
    }
  end

  @spec parse_deleted_at(String.t() | nil) :: DateTime.t() | nil
  defp parse_deleted_at(nil), do: nil

  defp parse_deleted_at(iso_string) when is_binary(iso_string) do
    case DateTime.from_iso8601(iso_string) do
      {:ok, datetime, _offset} -> datetime
      _ -> nil
    end
  end

  @spec format_deleted_at(DateTime.t() | nil) :: String.t() | nil
  defp format_deleted_at(nil), do: nil
  defp format_deleted_at(%DateTime{} = datetime), do: DateTime.to_iso8601(datetime)
end
