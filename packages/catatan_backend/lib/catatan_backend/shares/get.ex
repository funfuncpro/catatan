defmodule CatatanBackend.Shares.Get do
  @moduledoc """
  Internal module responsible for retrieving shared notes from the database.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Retrieves the complete share information by share_id.
  Returns all fields including access control settings.
  """
  @spec get_share(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_share(share_id) do
    query =
      "SELECT share_id, note_id, created_by, access_type, allowed_emails, created_at " <>
        "FROM notes_by_share WHERE share_id = :share_id"

    params = %{"share_id" => share_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] ->
          {:error, :not_found}

        [share] ->
          # Convert Cassandra set to list for easier handling
          share_with_list =
            Map.update(share, "allowed_emails", [], fn
              nil -> []
              emails when is_list(emails) -> emails
              emails -> MapSet.to_list(emails)
            end)

          {:ok, share_with_list}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves the note_id associated with a share_id (legacy support).
  """
  @spec get_note_id_by_share(String.t()) :: {:ok, String.t()} | {:error, :not_found | term()}
  def get_note_id_by_share(share_id) do
    case get_share(share_id) do
      {:ok, share} -> {:ok, Map.get(share, "note_id")}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves a note by share_id, returning the complete note data.
  Note: This does NOT check authorization - use Shares.Authorize for that.
  """
  @spec by_share_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def by_share_id(share_id) do
    with {:ok, note_id} <- get_note_id_by_share(share_id),
         {:ok, note} <- CatatanBackend.Notes.Get.by_id(note_id) do
      {:ok, note}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
