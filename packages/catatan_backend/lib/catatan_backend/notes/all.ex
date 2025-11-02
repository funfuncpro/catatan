defmodule CatatanBackend.Notes.All do
  @moduledoc """
  Internal module responsible for retrieving all notes from the database.
  """

  @doc """
  Retrieves all notes from the database.
  """
  @spec all() :: {:ok, list(map())} | {:error, term()}
  def all() do
    query = "SELECT note_id, content, created_at, updated_at FROM notes_by_id"

    with {:ok, prepared} <- CatatanBackend.CassandraClient.prepare(query),
         {:ok, result} <- CatatanBackend.CassandraClient.execute(prepared, %{}) do
      notes = Enum.map(result, fn row ->
        %{
          "note_id" => Map.get(row, "note_id"),
          "content" => Map.get(row, "content"),
          "created_at" => Map.get(row, "created_at"),
          "updated_at" => Map.get(row, "updated_at")
        }
      end)
      {:ok, notes}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
