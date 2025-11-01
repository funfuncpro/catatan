defmodule CatatanBackend.Notes.Create do
  def test_user() do
    notes = %{
      "id" => Nanoid.generate(),
      "name" => "Haekal"
    }

    query = "INSERT INTO test_user (id, name) VALUES (:id, :name)"

    with {:ok, prepared} <- CatatanBackend.CassandraClient.prepare(query),
         {:ok, _result} <-
           CatatanBackend.CassandraClient.execute(prepared, %{
             "id" => notes["id"],
             "name" => notes["name"]
           }) do
      {:ok, notes}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  def get_test_user() do
    query = "SELECT id, name FROM test_user"

    with {:ok, result} <- CatatanBackend.CassandraClient.execute(query) do
      users =
        Enum.map(result, fn row ->
          %{
            "id" => Map.get(row, "id"),
            "name" => Map.get(row, "name")
          }
        end)

      {:ok, users}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
