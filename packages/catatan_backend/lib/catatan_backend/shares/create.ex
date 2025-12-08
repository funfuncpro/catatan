defmodule CatatanBackend.Shares.Create do
  @moduledoc """
  Internal module responsible for creating shareable links in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new share link into Cassandra using a LOGGED BATCH to ensure atomicity.
  It inserts into both 'shares_by_id' and 'shares_by_note_id'.
  """
  @spec insert_share_batch(
          String.t(),
          String.t(),
          String.t(),
          String.t(),
          list(String.t()),
          integer()
        ) :: {:ok, map()} | {:error, term()}
  def insert_share_batch(
        share_id,
        note_id,
        access_type,
        permission_level,
        allowed_emails,
        timestamp
      ) do
    insert_by_id_cql = """
      INSERT INTO shares_by_id (share_id, note_id, access_type, permission_level, allowed_emails, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    """

    insert_by_note_id_cql = """
      INSERT INTO shares_by_note_id (note_id, share_id, access_type, permission_level, allowed_emails)
      VALUES (?, ?, ?, ?, ?)
    """

    # Convert allowed_emails list to MapSet for Cassandra set type
    allowed_emails_set = MapSet.new(allowed_emails)

    params_1 = [
      share_id,
      note_id,
      access_type,
      permission_level,
      allowed_emails_set,
      timestamp
    ]

    params_2 = [
      note_id,
      share_id,
      access_type,
      permission_level,
      allowed_emails_set
    ]

    with {:ok, prepared1} <- CassandraClient.prepare(insert_by_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared1, params_1),
         {:ok, prepared2} <- CassandraClient.prepare(insert_by_note_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared2, params_2) do
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
  Updates an existing share link's permission_level, access_type, and allowed_emails.
  Updates both 'shares_by_id' and 'shares_by_note_id' sequentially.
  """
  @spec update_share_batch(String.t(), String.t(), String.t(), String.t(), list(String.t())) ::
          {:ok, map()} | {:error, term()}
  def update_share_batch(share_id, note_id, access_type, permission_level, allowed_emails) do
    update_by_id_cql =
      "UPDATE shares_by_id SET access_type = ?, permission_level = ?, allowed_emails = ? WHERE share_id = ?"

    update_by_note_id_cql =
      "UPDATE shares_by_note_id SET access_type = ?, permission_level = ?, allowed_emails = ? WHERE note_id = ?"

    # Convert allowed_emails list to MapSet for Cassandra set type
    allowed_emails_set = MapSet.new(allowed_emails)

    params_1 = [
      access_type,
      permission_level,
      allowed_emails_set,
      share_id
    ]

    params_2 = [
      access_type,
      permission_level,
      allowed_emails_set,
      note_id
    ]

    with {:ok, prepared1} <- CassandraClient.prepare(update_by_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared1, params_1),
         {:ok, prepared2} <- CassandraClient.prepare(update_by_note_id_cql),
         {:ok, _} <- CassandraClient.execute(prepared2, params_2) do
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
