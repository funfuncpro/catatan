defmodule CatatanBackend.Notes.Store do
  @moduledoc """
  Internal module responsible for storing and retrieving notes from the database.
  """

  alias CatatanBackend.CassandraClient
  alias CatatanBackend.Notes.{Lww, NoteCrdt}

  @doc """
  This is an *upsert* operation: it overwrites existing note content.
  """
  @spec upsert(String.t(), term(), non_neg_integer(), String.t()) ::
          {:ok, NoteCrdt.t()} | {:error, term()}
  def upsert(note_id, replica_id, clock, body) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes_lww (note_id, replica_id, clock, body) VALUES (:note_id, :replica_id, :clock, :body)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "note_id" => note_id,
             "replica_id" => to_string(replica_id),
             "clock" => clock,
             "body" => body
           }) do
      lww = %Lww{
        content: body,
        clock: clock,
        replica_id: replica_id,
        last_updated: DateTime.utc_now()
      }

      note = %NoteCrdt{
        note_id: note_id,
        content: lww
      }

      {:ok, note}
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  rescue
    exception ->
      {:error, {:exception, exception}}
  end

  @doc """
  Retrieve a note by note_id, merging all replicas.

  Returns the merged NoteCrdt from all replicas for the given note_id.
  """
  @spec get(String.t()) :: {:ok, NoteCrdt.t()} | {:error, term()}
  def get(note_id) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "SELECT note_id, replica_id, clock, body FROM notes_lww WHERE note_id = :note_id ALLOW FILTERING"
           ),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(prepared, %{"note_id" => note_id}) do
      rows = Enum.to_list(page)

      if Enum.empty?(rows) do
        {:error, :not_found}
      else
        note = merge_replicas(note_id, rows)
        {:ok, note}
      end
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  rescue
    exception ->
      {:error, {:exception, exception}}
  end

  defp merge_replicas(note_id, replicas) do
    replicas
    |> Enum.map(&row_to_lww/1)
    |> Enum.reduce(&Lww.merge/2)
    |> then(fn merged_lww ->
      %NoteCrdt{
        note_id: note_id,
        content: merged_lww
      }
    end)
  end

  defp row_to_lww(row) do
    %Lww{
      content: row["body"] || "",
      clock: row["clock"] || 0,
      replica_id: row["replica_id"] || "",
      last_updated: DateTime.utc_now()
    }
  end
end
