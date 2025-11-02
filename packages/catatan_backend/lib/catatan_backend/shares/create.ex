defmodule CatatanBackend.Shares.Create do
  @moduledoc """
  Internal module responsible for creating shareable links in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new share link into the Cassandra database.
  """
  @spec insert_share(String.t(), String.t(), integer()) :: {:ok, map()} | {:error, term()}
  def insert_share(note_id, share_id, timestamp) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes_by_share(share_id, note_id, created_at) VALUES (:share_id, :note_id, :created_at)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "share_id" => share_id,
             "note_id" => note_id,
             "created_at" => timestamp
           }) do
      {:ok,
       %{
         "share_id" => share_id,
         "note_id" => note_id,
         "created_at" => timestamp
       }}
    end
  end
end
