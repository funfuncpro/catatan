defmodule CatatanBackend.Migrator do
  @moduledoc """
  Handles Cassandra database migrations.
  """

  @migrations_path "priv/migrations/cassandra"
  alias CatatanBackend.CassandraClient

  @doc """
  Runs all pending migrations.

  Returns `{:ok, count}` where count is the number of migrations run,
  or `{:error, reason}` if any migration fails.
  """
  @spec run() :: {:ok, non_neg_integer()} | {:error, term()}
  def run do
    with :ok <- ensure_migrations_table(),
         {:ok, pending} <- pending_migrations() do
      run_pending_migrations(pending)
    end
  end

  defp ensure_migrations_table do
    case CassandraClient.execute("SELECT version FROM schema_migrations LIMIT 1") do
      {:ok, _} ->
        :ok

      {:error, %Xandra.Error{reason: :invalid} = error} ->
        {:error,
         {:migrations_table_not_found,
          "schema_migrations table does not exist. Please create it manually.", error}}

      {:error, reason} ->
        {:error, {:migrations_table_check_failed, reason}}
    end
  end

  defp pending_migrations do
    with {:ok, executed} <- get_executed_versions(),
         {:ok, files} <- list_migration_files() do
      pending =
        files
        |> Enum.filter(&String.ends_with?(&1, ".cql"))
        |> Enum.sort()
        |> Enum.reject(fn file ->
          version = extract_version(file)
          MapSet.member?(executed, version)
        end)

      {:ok, pending}
    end
  end

  defp list_migration_files do
    case File.ls(@migrations_path) do
      {:ok, files} ->
        {:ok, files}

      {:error, :enoent} ->
        {:error, {:migrations_directory_not_found, @migrations_path}}

      {:error, reason} ->
        {:error, {:migrations_directory_read_failed, @migrations_path, reason}}
    end
  end

  defp run_pending_migrations(pending) do
    result =
      Enum.reduce_while(pending, {:ok, 0}, fn file, {:ok, count} ->
        case run_migration(file) do
          :ok -> {:cont, {:ok, count + 1}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)

    case result do
      {:ok, 0} ->
        IO.puts("No pending migrations.")
        {:ok, 0}

      {:ok, count} ->
        IO.puts("Successfully ran #{count} migration(s).")
        {:ok, count}

      {:error, _} = error ->
        error
    end
  end

  defp run_migration(file) do
    version = extract_version(file)
    path = Path.join(@migrations_path, file)

    with {:ok, cql} <- read_migration_file(path),
         :ok <- execute_migration_statements(cql, file),
         :ok <- record_migration_version(version) do
      IO.puts("Migrated: #{file}")
      :ok
    end
  end

  defp read_migration_file(path) do
    case File.read(path) do
      {:ok, content} ->
        {:ok, content}

      {:error, reason} ->
        {:error, {:migration_file_read_failed, path, reason}}
    end
  end

  defp execute_migration_statements(cql, file) do
    statements =
      cql
      |> String.split(";")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    Enum.reduce_while(statements, :ok, fn statement, :ok ->
      case CassandraClient.execute(statement) do
        {:ok, _} ->
          {:cont, :ok}

        {:error, reason} ->
          {:halt, {:error, {:migration_statement_failed, file, statement, reason}}}
      end
    end)
  end

  defp record_migration_version(version) do
    query =
      "INSERT INTO schema_migrations (version, executed_at) VALUES (:version, toTimestamp(now()))"

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, _result} <- CassandraClient.execute(prepared, %{"version" => version}) do
      :ok
    else
      {:error, reason} ->
        {:error, {:migration_version_record_failed, version, reason}}
    end
  end

  defp get_executed_versions do
    case CassandraClient.execute("SELECT version FROM schema_migrations") do
      {:ok, result} ->
        versions =
          result
          |> Enum.map(& &1["version"])
          |> MapSet.new()

        {:ok, versions}

      {:error, reason} ->
        {:error, {:failed_to_fetch_executed_versions, reason}}
    end
  end

  defp extract_version(filename) do
    filename
    |> String.split("_")
    |> List.first()
  end
end
