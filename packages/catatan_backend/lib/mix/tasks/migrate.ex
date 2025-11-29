defmodule Mix.Tasks.Migrate do
  @moduledoc """
  Runs Cassandra migrations.

  ## Usage

      mix migrate

  Returns exit code 0 on success, 1 on failure.
  """
  use Mix.Task

  @shortdoc "Runs Cassandra migrations"

  @impl Mix.Task
  def run(_args) do
    Mix.Task.run("app.start")

    case CatatanBackend.Migrator.run() do
      {:ok, _count} ->
        :ok

      {:error, reason} ->
        Mix.raise(format_error(reason))
    end
  end

  defp format_error({:migrations_table_not_found, message, _error}) do
    message
  end

  defp format_error({:migrations_table_check_failed, reason}) do
    "Failed to check migrations table: #{inspect(reason)}"
  end

  defp format_error({:failed_to_fetch_executed_versions, reason}) do
    "Failed to fetch executed migration versions: #{inspect(reason)}"
  end

  defp format_error({:migrations_directory_not_found, path}) do
    "Migrations directory not found: #{path}"
  end

  defp format_error({:migrations_directory_read_failed, path, reason}) do
    "Failed to read migrations directory #{path}: #{inspect(reason)}"
  end

  defp format_error({:migration_file_read_failed, path, reason}) do
    "Failed to read migration file #{path}: #{inspect(reason)}"
  end

  defp format_error({:migration_statement_failed, file, statement, reason}) do
    """
    Migration failed: #{file}
    Statement: #{String.slice(statement, 0, 200)}#{if String.length(statement) > 200, do: "...", else: ""}
    Error: #{inspect(reason)}
    """
  end

  defp format_error({:migration_version_record_failed, version, reason}) do
    "Failed to record migration version #{version}: #{inspect(reason)}"
  end

  defp format_error(reason) do
    "Migration failed: #{inspect(reason)}"
  end
end
