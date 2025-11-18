defmodule CatatanBackend.ApiKey.Store do
  @moduledoc """
  This module responsible for storing and retrieving API keys.
  """

  alias CatatanBackend.CassandraClient

  @spec create(%{
          id: String.t(),
          hashed_api_key: String.t(),
          datetime: DateTime.t()
        }) :: map()
  def create(%{id: id, hashed_api_key: hashed_api_key, datetime: datetime}) do
    with {:ok, preapered} <-
           CassandraClient.prepare(
             "INSERT INTO api_key (id, created_at, updated_at, value) VALUES (:id, :created_at, :updated_at, :value)"
           ),
         {:ok, result} <-
           CassandraClient.execute(preapered, %{
             "id" => id,
             "created_at" => datetime |> DateTime.to_unix(:millisecond),
             "updated_at" => datetime |> DateTime.to_unix(:millisecond),
             "value" => hashed_api_key
           }) do
      case result do
        %Xandra.Void{} ->
          %{
            id: id,
            created_at: datetime,
            updated_at: datetime,
            value: hashed_api_key
          }

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
             value: String.t()
           }}
          | {:error, term()}
  def get(%{
        id: id
      }) do
    with {:ok, preapered} <-
           CassandraClient.prepare(
             "SELECT id, created_at, updated_at, value FROM api_key WHERE id = :id"
           ),
         {:ok, %Xandra.Page{} = page} <-
           CassandraClient.execute(preapered, %{
             "id" => id
           }) do
      case page |> Enum.to_list() |> Enum.at(0) do
        nil ->
          {:error, :not_found}

        record ->
          {:ok, record |> Map.new()}
      end
    else
      {:error, reason} ->
        {:error, {:cassandra, reason}}
    end
  end
end
