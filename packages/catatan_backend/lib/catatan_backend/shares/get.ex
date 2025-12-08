defmodule CatatanBackend.Shares.Get do
  @moduledoc """
  Internal module responsible for retrieving shared notes from the database.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Retrieves full share details by share_id from the shares_by_id table.
  """
  @spec get_share_details_by_share_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_share_details_by_share_id(share_id) do
    query =
      "SELECT share_id, note_id, access_type, permission_level, allowed_emails, created_at FROM shares_by_id WHERE share_id = :share_id"

    params = %{"share_id" => share_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] ->
          {:error, :not_found}

        [share_details] ->
          details =
            share_details
            |> Map.put_new("permission_level", "read")
            |> convert_allowed_emails_to_list()

          {:ok, details}
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
  Retrieves share_id, access_type, permission_level, and allowed_emails by note_id from the shares_by_note_id table.
  """
  @spec by_note_id(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def by_note_id(note_id) do
    query =
      "SELECT share_id, access_type, permission_level, allowed_emails FROM shares_by_note_id WHERE note_id = :note_id"

    params = %{"note_id" => note_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] ->
          {:error, :not_found}

        [share] ->
          details =
            share
            |> Map.put_new("permission_level", "read")
            |> convert_allowed_emails_to_list()

          {:ok, details}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves the permission level for a given share_id.
  """
  @spec get_permission_level(String.t()) :: {:ok, String.t()} | {:error, :not_found | term()}
  def get_permission_level(share_id) do
    with {:ok, share_details} <- get_share_details_by_share_id(share_id) do
      permission = Map.get(share_details, "permission_level", "read")
      {:ok, permission}
    end
  end

  defp convert_allowed_emails_to_list(map) do
    case Map.get(map, "allowed_emails") do
      %MapSet{} = set -> Map.put(map, "allowed_emails", MapSet.to_list(set))
      _ -> map
    end
  end
end
