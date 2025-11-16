defmodule CatatanBackend.CassandraClient do
  def execute(query, params \\ []) do
    Xandra.execute(:xandra_connection, query, params, consistency: :local_quorum)
  end

  def prepare(query) do
    Xandra.prepare(:xandra_connection, query)
  end
end
