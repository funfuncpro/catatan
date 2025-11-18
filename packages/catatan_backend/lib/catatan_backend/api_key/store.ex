defmodule CatatanBackend.ApiKey.Store do
  @moduledoc """
  This module responsible for storing and retrieving API keys.
  """

  alias CatatanBackend.CassandraClient

  @spec create(%{
          id: String.t(),
          hashed_api_key: String.t(),
          datetime: DateTime.t()
        }) ::
          {:ok,
           %{
             id: String.t(),
             created_at: integer(),
             updated_at: integer(),
             key: String.t()
           }}
          | {:error, term()}
  def create(%{id: id, hashed_api_key: hashed_api_key, datetime: datetime}) do
    with {:ok, preapered} <-
           CassandraClient.prepare(
             "INSERT INTO api_key (id, key, created_at, updated_at) VALUES (:id, :key, :created_at, :updated_at)"
           ),
         {:ok, result} <-
           CassandraClient.execute(preapered, %{
             "id" => id,
             "key" => hashed_api_key,
             "created_at" => datetime |> DateTime.to_unix(:millisecond),
             "updated_at" => datetime |> DateTime.to_unix(:millisecond)
           }) do
      case result do
        %Xandra.Void{} ->
          {:ok,
           %{
             id: id,
             created_at: datetime |> DateTime.to_unix(:millisecond),
             updated_at: datetime |> DateTime.to_unix(:millisecond),
             key: hashed_api_key
           }}

        _ ->
          {:error, :unexpected_result}
      end
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  rescue
    exception ->
      {:error, {:exception, exception}}
  end

  @spec get(%{
          id: String.t(),
          hashed_api_key: String.t()
        }) ::
          {:ok,
           %{
             id: String.t(),
             created_at: integer(),
             updated_at: integer(),
             key: String.t()
           }}
          | {:error, term()}
  def get(%{
        id: id
      }) do
    with {:ok, preapered} <-
           CassandraClient.prepare(
             "SELECT id, created_at, updated_at, key FROM api_key WHERE id = :id"
           ),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(preapered, %{
             "id" => id
           }) do
      case page |> Enum.to_list() |> Enum.at(0) do
        nil ->
          {:error, :not_found}

        record ->
          {:ok,
           %{
             id: Map.get(record, "id"),
             created_at: Map.get(record, "created_at"),
             updated_at: Map.get(record, "updated_at"),
             key: Map.get(record, "key")
           }}
      end
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  end
end
