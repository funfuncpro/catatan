defmodule CatatanBackend.Encryption do
  @moduledoc """
  Handles encryption and decryption of note content using AES-256-GCM.

  This module provides application-level encryption for notes stored in Cassandra.
  Data is encrypted before being written to the database and decrypted after reading.

  ## Algorithm: AES-256-GCM
  - **Key Size:** 256 bits (32 bytes)
  - **IV Size:** 96 bits (12 bytes) - recommended for GCM mode
  - **Tag Size:** 128 bits (16 bytes) - authentication tag
  - **AAD:** "catatan_notes_v1" - additional authenticated data for versioning

  ## Storage Format
  Encrypted data is stored as: `IV (12 bytes) || Ciphertext (variable) || Tag (16 bytes)`
  """

  require Logger

  @aad "catatan_notes_v1"
  @iv_size 12
  @tag_size 16
  @min_encrypted_size @iv_size + @tag_size

  @doc """
  Encrypts plaintext content using AES-256-GCM.

  Returns `{:ok, encrypted_binary}` where the binary contains IV, ciphertext, and authentication tag.

  ## Parameters
  - `plaintext` - String content to encrypt

  ## Returns
  - `{:ok, binary}` - Encrypted data (IV || Ciphertext || Tag)
  - `{:error, :encryption_failed}` - If encryption fails
  - `{:error, :key_not_found}` - If encryption key is not configured
  """
  @spec encrypt(String.t()) :: {:ok, binary()} | {:error, atom()}
  def encrypt(plaintext) when is_binary(plaintext) do
    with {:ok, key} <- get_encryption_key(),
         iv <- :crypto.strong_rand_bytes(@iv_size),
         {ciphertext, tag} <- encrypt_aes_gcm(key, iv, plaintext) do
      encrypted_data = iv <> ciphertext <> tag
      {:ok, encrypted_data}
    else
      {:error, reason} ->
        Logger.error("Encryption failed: #{inspect(reason)}")
        {:error, :encryption_failed}

      error ->
        Logger.error("Unexpected encryption error: #{inspect(error)}")
        {:error, :encryption_failed}
    end
  rescue
    exception ->
      Logger.error("Encryption exception: #{inspect(exception)}")
      {:error, :encryption_failed}
  end

  @doc """
  Decrypts encrypted content using AES-256-GCM.

  Returns `{:ok, plaintext}` if decryption succeeds and authentication tag is valid.

  ## Parameters
  - `encrypted_data` - Binary data containing IV, ciphertext, and tag

  ## Returns
  - `{:ok, string}` - Decrypted plaintext content
  - `{:error, :decryption_failed}` - If decryption fails or tag verification fails
  - `{:error, :invalid_ciphertext}` - If encrypted data format is invalid
  - `{:error, :key_not_found}` - If encryption key is not configured
  """
  @spec decrypt(binary()) :: {:ok, String.t()} | {:error, atom()}
  def decrypt(encrypted_data) when is_binary(encrypted_data) do
    with {:ok, :valid_size} <- validate_encrypted_size(encrypted_data),
         {:ok, key} <- get_encryption_key(),
         {:ok, iv, ciphertext, tag} <- extract_components(encrypted_data),
         plaintext when is_binary(plaintext) <- decrypt_aes_gcm(key, iv, ciphertext, tag) do
      {:ok, plaintext}
    else
      {:error, reason} when is_atom(reason) ->
        Logger.warning("Decryption failed: #{inspect(reason)}")
        {:error, reason}

      :error ->
        Logger.warning("Decryption failed: authentication tag verification failed")
        {:error, :decryption_failed}

      error ->
        Logger.error("Unexpected decryption error: #{inspect(error)}")
        {:error, :decryption_failed}
    end
  rescue
    exception ->
      Logger.error("Decryption exception: #{inspect(exception)}")
      {:error, :decryption_failed}
  end

  @doc """
  Checks if data appears to be encrypted.

  This is a heuristic check - encrypted data should be at least 28 bytes
  (12 IV + 16 tag) and should not be valid UTF-8 text.
  """
  @spec encrypted?(binary()) :: boolean()
  def encrypted?(data) when is_binary(data) do
    byte_size(data) >= @min_encrypted_size and not String.valid?(data)
  end

  @doc """
  Generates a new random encryption key (32 bytes for AES-256).

  Returns a base64-encoded key suitable for use in environment variables.
  """
  @spec generate_key() :: String.t()
  def generate_key do
    :crypto.strong_rand_bytes(32)
    |> Base.encode64()
  end

  # Private functions

  @spec get_encryption_key() :: {:ok, binary()} | {:error, :key_not_found}
  defp get_encryption_key do
    case Application.get_env(:catatan_backend, CatatanBackend.Encryption)[:key] do
      nil ->
        Logger.error("Encryption key not found in configuration")
        {:error, :key_not_found}

      key when is_binary(key) ->
        # Check if key is already decoded (32 bytes raw binary)
        if byte_size(key) == 32 do
          {:ok, key}
        else
          # Try to decode from base64
          case Base.decode64(key) do
            {:ok, decoded_key} when byte_size(decoded_key) == 32 ->
              {:ok, decoded_key}

            {:ok, _invalid_size} ->
              Logger.error("Encryption key must be 32 bytes (256 bits)")
              {:error, :invalid_key_size}

            :error ->
              Logger.error("Encryption key is not valid base64 or 32-byte binary")
              {:error, :invalid_key_encoding}
          end
        end
    end
  end

  @spec encrypt_aes_gcm(binary(), binary(), String.t()) :: {binary(), binary()}
  defp encrypt_aes_gcm(key, iv, plaintext) do
    :crypto.crypto_one_time_aead(
      :aes_256_gcm,
      key,
      iv,
      plaintext,
      @aad,
      true
    )
  end

  @spec decrypt_aes_gcm(binary(), binary(), binary(), binary()) :: binary() | :error
  defp decrypt_aes_gcm(key, iv, ciphertext, tag) do
    :crypto.crypto_one_time_aead(
      :aes_256_gcm,
      key,
      iv,
      ciphertext,
      @aad,
      tag,
      false
    )
  end

  @spec validate_encrypted_size(binary()) :: {:ok, :valid_size} | {:error, :invalid_ciphertext}
  defp validate_encrypted_size(data) do
    if byte_size(data) >= @min_encrypted_size do
      {:ok, :valid_size}
    else
      {:error, :invalid_ciphertext}
    end
  end

  @spec extract_components(binary()) :: {:ok, binary(), binary(), binary()} | {:error, atom()}
  defp extract_components(encrypted_data) do
    try do
      <<iv::binary-size(@iv_size), rest::binary>> = encrypted_data
      ciphertext_size = byte_size(rest) - @tag_size
      <<ciphertext::binary-size(ciphertext_size), tag::binary-size(@tag_size)>> = rest
      {:ok, iv, ciphertext, tag}
    rescue
      _ -> {:error, :invalid_ciphertext}
    end
  end
end
