defmodule CatatanBackend.Shares.Get do
  @moduledoc """
  Internal module responsible for retrieving shared notes from the database.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Retrieves the note_id associated with a share_id.
  """
  @spec get_note_id_by_share(String.t()) :: {:ok, String.t()} | {:error, :not_found | term()}
  def get_note_id_by_share(share_id) do
    query = "SELECT note_id FROM notes_by_share WHERE share_id = :share_id"
    params = %{"share_id" => share_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] -> {:error, :not_found}
        [share] -> {:ok, Map.get(share, "note_id")}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves a note by share_id, returning the complete note data.
  """
  @spec by_share_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def by_share_id(share_id) do
    with {:ok, note_id} <- get_note_id_by_share(share_id),
         {:ok, note} <- CatatanBackend.Notes.get_note_by_id(note_id) do
      {:ok, note}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
