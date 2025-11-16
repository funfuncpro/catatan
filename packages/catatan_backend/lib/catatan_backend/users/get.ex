defmodule CatatanBackend.Users.Get do
  @moduledoc """
  Internal module responsible for retrieving users from the database.
  """

  alias CatatanBackend.CassandraClient

  @doc """
  Retrieves a user by their email address.
  """
  @spec get_user_by_email(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_user_by_email(email) do
    query = "SELECT user_id, email, external_id, created_at, updated_at FROM users WHERE email = :email ALLOW FILTERING"
    params = %{"email" => email}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] -> {:error, :not_found}
        [user] -> {:ok, user}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Retrieves a user by their user_id.
  """
  @spec get_user(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_user(user_id) do
    query = "SELECT user_id, email, external_id, created_at, updated_at FROM users WHERE user_id = :user_id"
    params = %{"user_id" => user_id}

    with {:ok, prepared} <- CassandraClient.prepare(query),
         {:ok, result} <- CassandraClient.execute(prepared, params) do
      rows = Enum.to_list(result)

      case rows do
        [] -> {:error, :not_found}
        [user] -> {:ok, user}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
