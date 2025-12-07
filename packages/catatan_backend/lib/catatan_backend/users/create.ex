defmodule CatatanBackend.Users.Create do
  @moduledoc """
  Internal module responsible for creating users in the CatatanBackend application.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Inserts a new user into the Cassandra database.
  """
  @spec insert_user(String.t(), String.t(), String.t(), integer(), integer()) ::
          {:ok, map()} | {:error, term()}
  def insert_user(user_id, email, external_id, created_at, updated_at) do
    with {:ok, prepared} <-
           CassandraClient.prepare(
             "INSERT INTO users(user_id, email, external_id, created_at, updated_at) VALUES (:user_id, :email, :external_id, :created_at, :updated_at)"
           ),
         {:ok, _result} <-
           CassandraClient.execute(prepared, %{
             "user_id" => user_id,
             "email" => email,
             "external_id" => external_id,
             "created_at" => created_at,
             "updated_at" => updated_at
           }) do
      {:ok,
       %{
         "user_id" => user_id,
         "email" => email,
         "external_id" => external_id,
         "created_at" => created_at,
         "updated_at" => updated_at
       }}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
