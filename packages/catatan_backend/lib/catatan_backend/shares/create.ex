defmodule CatatanBackend.Shares.Create do
  @moduledoc """
  Internal module responsible for creating shareable links in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new share link into the Cassandra database with access control.
  """
  @spec insert_share(String.t(), String.t(), String.t() | nil, String.t(), list(String.t()), integer()) ::
          {:ok, map()} | {:error, term()}
  def insert_share(note_id, share_id, created_by, access_type, allowed_emails, timestamp) do
    # Convert list to Cassandra set - Xandra requires MapSet, not list
    emails_set = MapSet.new(allowed_emails || [])

    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes_by_share(share_id, note_id, created_by, access_type, allowed_emails, created_at) " <>
               "VALUES (:share_id, :note_id, :created_by, :access_type, :allowed_emails, :created_at)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "share_id" => share_id,
             "note_id" => note_id,
             "created_by" => created_by,
             "access_type" => access_type,
             "allowed_emails" => emails_set,
             "created_at" => timestamp
           }) do
      {:ok,
       %{
         "share_id" => share_id,
         "note_id" => note_id,
         "created_by" => created_by,
         "access_type" => access_type,
         "allowed_emails" => MapSet.to_list(emails_set),
         "created_at" => timestamp
       }}
    end
  end
end
