defmodule CatatanBackend.Hash.Argon do
  @moduledoc """
  Module for hashing and verifying passwords using Argon2.

  Argon2 provides protection against timing attacks and is the
  recommended algorithm for password hashing.
  """
  @spec hash_value(String.t()) :: String.t()
  def hash_value(value) when is_binary(value) and byte_size(value) > 0 do
    Argon2.hash_pwd_salt(value)
  end

  @spec verify_value(String.t(), String.t()) :: boolean()
  def verify_value(value, stored_hash)
      when is_binary(value) and is_binary(stored_hash) do
    Argon2.verify_pass(value, stored_hash)
  rescue
    _error -> false
  end
end
