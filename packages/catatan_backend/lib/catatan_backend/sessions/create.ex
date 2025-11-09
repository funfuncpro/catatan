defmodule CatatanBackend.Sessions.Create do
  @moduledoc """
  Internal module responsible for creating sessions in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new session into the Cassandra database.
  """
  @spec insert_session(String.t(), String.t(), integer()) :: {:ok, map()} | {:error, term()}
  def insert_session(session_id, note_id, timestamp) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO sessions(session_id, note_id, created_at) VALUES (:session_id, :note_id, :created_at)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "session_id" => session_id,
             "note_id" => note_id,
             "created_at" => timestamp
           }) do
      {:ok,
       %{
         "session_id" => session_id,
         "note_id" => note_id,
         "created_at" => timestamp
       }}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
