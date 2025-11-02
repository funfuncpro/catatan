defmodule CatatanBackend.Notes.Get do
  @moduledoc """
  Internal module responsible for retrieving notes from the database.
  """

  @doc """
  Retrieves a single note from the database by its ID.
  """
  @spec by_id(String.t()) :: {:ok, map()} | {:error, :not_found}
  def by_id(note_id) do
    query = "SELECT note_id, content, created_at, updated_at FROM notes_by_id WHERE note_id = :note_id"
    params = %{"note_id" => note_id}

    with {:ok, prepared} <- CatatanBackend.CassandraClient.prepare(query),
         {:ok, result} <- CatatanBackend.CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] -> {:error, :not_found}
        [note] ->
          note_map =
            %{
              "note_id" => Map.get(note, "note_id"),
              "content" => Map.get(note, "content"),
              "created_at" => Map.get(note, "created_at"),
              "updated_at" => Map.get(note, "updated_at")
            }
          {:ok, note_map}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
