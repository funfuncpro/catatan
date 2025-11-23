defmodule CatatanBackend.Shares.Create do
  @moduledoc """
  Internal module responsible for creating shareable links in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new share link into Cassandra.
  It inserts into both the 'notes_by_share' and 'shares_by_note_id' tables.
  """
  @spec insert_share_batch(String.t(), String.t(), String.t(), list(String.t()), integer()) :: {:ok, map()} | {:error, term()}
  def insert_share_batch(share_id, note_id, access_type, allowed_emails, timestamp) do
    insert_shares_by_id_cql =
      "INSERT INTO catatan_keyspaces.notes_by_share (share_id, note_id, access_type, allowed_emails, created_at) VALUES (?, ?, ?, ?, ?)"

    insert_shares_by_note_id_cql =
      "INSERT INTO catatan_keyspaces.shares_by_note_id (note_id, share_id, access_type) VALUES (?, ?, ?)"

    # Convert allowed_emails list to MapSet for Cassandra set type
    allowed_emails_set = MapSet.new(allowed_emails)

    with {:ok, prepared1} <- CassandraClient.prepare(insert_shares_by_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared1, [share_id, note_id, access_type, allowed_emails_set, timestamp]),
         {:ok, prepared2} <- CassandraClient.prepare(insert_shares_by_note_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared2, [note_id, share_id, access_type]) do
      {:ok,
       %{
         "share_id" => share_id,
         "note_id" => note_id,
         "access_type" => access_type,
         "allowed_emails" => allowed_emails,
         "created_at" => timestamp
       }}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
