defmodule CatatanBackend.Notes.Get do
  alias CatatanBackend.CassandraClient

  @moduledoc """
  Internal Module responsible for retrieving notes in the CatatanBackend application.
  """

  @doc """
  Retrieves a note by its ID.
  """
  @spec get_note_by_id(String.t()) :: {:ok, map()} | {:error, :not_found}
  def get_note_by_id(note_id) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "SELECT note_id, content, created_at, updated_at FROM notes_by_id WHERE note_id = :id"
           ),
         {:ok, result} <-
           CassandraClient.execute(prepared, %{"id" => note_id}) do
      case Enum.to_list(result) do
        [] ->
          {:error, :not_found}

        [note | _] ->
          {:ok, note}
      end
    end
  end
end
