defmodule Mix.Tasks.Migrate.Create do
  use Mix.Task

  @shortdoc "Creates a new migration file"
  def run([name]) do
    safe_name = name |> String.replace(~r/[\/\\]/, "_")
    timestamp = DateTime.utc_now() |> Calendar.strftime("%Y%m%d%H%M%S")
    filename = "#{timestamp}_#{safe_name}.cql"
    path = Path.join("priv/migrations/cassandra", filename)
    File.write!(path, "-- #{safe_name}\n\n")
    IO.puts("Created: #{path}")
  end
end
