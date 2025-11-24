defmodule CatatanBackend.Shares.Create do
  @moduledoc """
  Internal module responsible for creating shareable links in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new share link into Cassandra.
  It inserts into both the 'notes_by_share' and 'shares_by_note_id' tables.
  """
  @spec insert_share_batch(String.t(), String.t(), String.t(), String.t(), list(String.t()), integer()) :: {:ok, map()} | {:error, term()}
  def insert_share_batch(share_id, note_id, access_type, permission_level, allowed_emails, timestamp) do
    insert_shares_by_id_cql =
      "INSERT INTO catatan_keyspaces.notes_by_share (share_id, note_id, access_type, permission_level, allowed_emails, created_at) VALUES (?, ?, ?, ?, ?, ?)"

    insert_shares_by_note_id_cql =
      "INSERT INTO catatan_keyspaces.shares_by_note_id (note_id, share_id, access_type, permission_level) VALUES (?, ?, ?, ?)"

    # Convert allowed_emails list to MapSet for Cassandra set type
    allowed_emails_set = MapSet.new(allowed_emails)

    with {:ok, prepared1} <- CassandraClient.prepare(insert_shares_by_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared1, [share_id, note_id, access_type, permission_level, allowed_emails_set, timestamp]),
         {:ok, prepared2} <- CassandraClient.prepare(insert_shares_by_note_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared2, [note_id, share_id, access_type, permission_level]) do
      {:ok,
       %{
         "share_id" => share_id,
         "note_id" => note_id,
         "access_type" => access_type,
         "permission_level" => permission_level,
         "allowed_emails" => allowed_emails,
         "created_at" => timestamp
       }}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Updates an existing share link's permission_level and access_type.
  Updates both the 'notes_by_share' and 'shares_by_note_id' tables.
  """
  @spec update_share_batch(String.t(), String.t(), String.t(), String.t(), list(String.t())) :: {:ok, map()} | {:error, term()}
  def update_share_batch(share_id, note_id, access_type, permission_level, allowed_emails) do
    update_shares_by_id_cql =
      "UPDATE catatan_keyspaces.notes_by_share SET access_type = ?, permission_level = ?, allowed_emails = ? WHERE share_id = ?"

    update_shares_by_note_id_cql =
      "UPDATE catatan_keyspaces.shares_by_note_id SET access_type = ?, permission_level = ? WHERE note_id = ?"

    # Convert allowed_emails list to MapSet for Cassandra set type
    allowed_emails_set = MapSet.new(allowed_emails)

    with {:ok, prepared1} <- CassandraClient.prepare(update_shares_by_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared1, [access_type, permission_level, allowed_emails_set, share_id]),
         {:ok, prepared2} <- CassandraClient.prepare(update_shares_by_note_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared2, [access_type, permission_level, note_id]) do
      {:ok,
       %{
         "share_id" => share_id,
         "note_id" => note_id,
         "access_type" => access_type,
         "permission_level" => permission_level,
         "allowed_emails" => allowed_emails
       }}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
