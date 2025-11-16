defmodule CatatanBackend.Users do
  @moduledoc """
  Public module for Users context in the CatatanBackend application.

  This module provides the public API for creating and managing authenticated users
  from OpenAuth.
  """

  alias CatatanBackend.GenerateID
  alias CatatanBackend.Users.Create
  alias CatatanBackend.Users.Get

  @doc """
  Creates or updates a user from OpenAuth token claims.
  Returns the user_id.
  """
  @spec upsert_user(String.t(), String.t()) :: {:ok, String.t()} | {:error, term()}
  def upsert_user(email, external_id) do
    case Get.get_user_by_email(email) do
      {:ok, user} ->
        # User exists, update if needed
        # Cassandra returns map with string keys
        {:ok, user["user_id"]}

      {:error, :not_found} ->
        # Create new user
        user_id = GenerateID.generate_nano_id()
        now = DateTime.utc_now() |> DateTime.to_unix(:millisecond)

        case Create.insert_user(user_id, email, external_id, now, now) do
          {:ok, _} -> {:ok, user_id}
          {:error, reason} -> {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Retrieves a user by their email.
  """
  @spec get_user_by_email(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_user_by_email(email) do
    Get.get_user_by_email(email)
  end

  @doc """
  Retrieves a user by their user_id.
  """
  @spec get_user(String.t()) :: {:ok, map()} | {:error, :not_found | term()}
  def get_user(user_id) do
    Get.get_user(user_id)
  end
end
