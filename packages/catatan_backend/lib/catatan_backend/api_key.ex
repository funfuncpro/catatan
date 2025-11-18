defmodule CatatanBackend.ApiKey do
  @moduledoc """
  This module provides functions for generating API keys.
  """

  alias CatatanBackend.ApiKey.{Generate, Store, Parse}
  alias CatatanBackend.Hash.Argon
  alias CatatanBackend.GenerateID

  @doc """
  Generate a new API key.
  """
  @spec generate_api_key() :: String.t()
  def generate_api_key() do
    id = GenerateID.generate_nano_id()
    key = Generate.generate_random_key()
    api_key = Generate.generate_api_key(id, key)
    hashed_key = Argon.hash_value(api_key)
    datetime = DateTime.utc_now()

    with {:ok, _result} <- Store.create(%{id: id, hashed_api_key: hashed_key, datetime: datetime}) do
      api_key
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @spec verify_api_key(String.t()) :: {:ok, String.t()} | {:error, :invalid_api_key}
  def verify_api_key(api_key) do
    with {:ok, %{id: id}} <- Parse.parse(api_key),
         {:ok, %{key: hashed_value}} <- Store.get(%{id: id}),
         true <- Argon.verify_value(api_key, hashed_value) do
      {:ok, id}
    else
      {:error, reason} -> {:error, reason}
    end
  end
end
