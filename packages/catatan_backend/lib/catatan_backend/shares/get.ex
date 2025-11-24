defmodule CatatanBackend.Shares.Get do
  @moduledoc """
  Internal module responsible for retrieving shared notes from the database.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Retrieves full share details by share_id from the notes_by_share table.
  """
  @spec get_share_details_by_share_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_share_details_by_share_id(share_id) do
    # Query all details from the new notes_by_share table
    query = "SELECT share_id, note_id, access_type, allowed_emails, created_at FROM catatan_keyspaces.notes_by_share WHERE share_id = :share_id"
    params = %{"share_id" => share_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] -> {:error, :not_found}
        [share_details] -> {:ok, share_details}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves a note by share_id, returning the complete note data.
  It first fetches share details and then the note content.
  """
  @spec by_share_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def by_share_id(share_id) do
    with {:ok, %{"note_id" => note_id}} <- get_share_details_by_share_id(share_id),
         {:ok, note} <- CatatanBackend.Notes.get_note_by_id(note_id) do
      {:ok, note}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves share_id and access_type by note_id from the shares_by_note_id table.
  """
  @spec by_note_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def by_note_id(note_id) do
    query = "SELECT share_id, access_type FROM catatan_keyspaces.shares_by_note_id WHERE note_id = :note_id"
    params = %{"note_id" => note_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] -> {:error, :not_found}
        [share] -> {:ok, share}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
