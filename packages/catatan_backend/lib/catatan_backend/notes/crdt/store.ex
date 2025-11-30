defmodule CatatanBackend.Notes.Crdt.Store do
  alias CatatanBackend.CassandraClient
  alias CatatanBackend.Notes.Crdt.Element

  @spec save_element(Element.t()) :: :ok | {:error, term()}
  def save_element(%Element{} = element) do
    {writer_id, clock} = element.id
    element_id = "#{writer_id}:#{clock}"

    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes_elements (note_id, element_id, origin_id, right_origin_id, content, deleted_at, created_at) VALUES (:note_id, :element_id, :origin_id, :right_origin_id, :content, :deleted_at, :created_at)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "note_id" => element.note_id,
             "element_id" => element_id,
             "origin_id" => format_id(element.origin),
             "right_origin_id" => format_id(element.right_origin),
             "content" => element.content,
             "deleted_at" => element.deleted_at,
             "created_at" => DateTime.utc_now()
           }) do
      :ok
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  end

  @spec load_elements(String.t()) :: {:ok, [Element.t()]} | {:error, term()}
  def load_elements(note_id) do
    with {:ok, prepared} <-
           CassandraClient.prepare("SELECT * FROM notes_elements WHERE note_id = :note_id"),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(prepared, %{
             "note_id" => note_id
           }) do
      elements = Enum.map(page, &row_to_element/1)
      {:ok, elements}
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  end

  @spec mark_deleted(String.t(), String.t(), DateTime.t()) :: :ok | {:error, term()}
  def mark_deleted(note_id, element_id, deleted_at) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "UPDATE notes_elements SET deleted_at = :deleted_at WHERE note_id = :note_id AND element_id = :element_id"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "deleted_at" => deleted_at,
             "note_id" => note_id,
             "element_id" => element_id
           }) do
      :ok
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  end

  @spec save_state_vector(String.t(), String.t(), integer()) :: :ok | {:error, term()}
  def save_state_vector(note_id, writer_id, clock) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO notes_state_vectors (note_id, writer_id, clock, updated_at) VALUES (:note_id, :writer_id, :clock, toTimestamp(now()))"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "note_id" => note_id,
             "writer_id" => writer_id,
             "clock" => clock
           }) do
      :ok
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  end

  @spec load_state_vector(String.t()) :: {:ok, map()} | {:error, term()}
  def load_state_vector(note_id) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "SELECT writer_id, clock FROM notes_state_vectors WHERE note_id = :note_id"
           ),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(prepared, %{
             "note_id" => note_id
           }) do
      state_vector =
        page
        |> Enum.reduce(%{}, fn row, acc ->
          Map.put(acc, row["writer_id"], row["clock"])
        end)

      {:ok, state_vector}
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  end

  defp format_id({writer_id, clock}), do: "#{writer_id}:#{clock}"
  defp format_id(nil), do: nil

  defp row_to_element(row) do
    %Element{
      id: parse_id(row["element_id"]),
      note_id: row["note_id"],
      origin: parse_id(row["origin_id"]),
      right_origin: parse_id(row["right_origin_id"]),
      content: row["content"],
      deleted_at: row["deleted_at"]
    }
  end

  defp parse_id(nil), do: nil

  defp parse_id(str) do
    [writer_id, clock] = String.split(str, ":")
    {writer_id, String.to_integer(clock)}
  end
end
