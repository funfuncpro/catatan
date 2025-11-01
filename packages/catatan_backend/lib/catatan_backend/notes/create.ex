defmodule CatatanBackend.Notes.Create do
  @moduledoc """
  Internal Module responsible for creating notes in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new note into the Cassandra database.
  @content: :string
  @note_id: :string
  @timestamp: :integer (epoch time in milliseconds)
  """
  @spec insert_created_note(String.t(), String.t(), Integer.t()) :: map()
  def insert_created_note(content, note_id, timestamp) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes_by_id(note_id, content, created_at, updated_at) VALUES (:id, :content, :created_at, :updated_at)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "id" => note_id,
             "content" => content,
             "created_at" => timestamp,
             "updated_at" => timestamp
           }) do
      {:ok,
       %{
         "note_id" => note_id,
         "content" => content,
         "created_at" => timestamp,
         "updated_at" => timestamp
       }}
    end
  end
end
