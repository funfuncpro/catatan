defmodule CatatanBackend.ApiKey.Generate do
  @moduledoc """
  This module provides functions for generating API keys.
  """

  @spec generate_api_key(String.t(), String.t()) :: String.t()
  def generate_api_key(id, key) do
    "catatan_#{id}:#{key}"
  end

  @spec generate_random_key() :: String.t()
  def generate_random_key() do
    :crypto.strong_rand_bytes(32) |> Base.encode64()
  end
end
