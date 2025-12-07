defmodule CatatanBackend.OpenAuthClient do
  @moduledoc """
  Client for verifying OpenAuth JWT tokens.

  This module handles:
  - Fetching JWKS (JSON Web Key Set) from the OpenAuth issuer
  - Verifying JWT tokens using the public keys
  - Decoding and validating token claims
  """

  require Logger

  @issuer_url Application.compile_env(:catatan_backend, :openauth_issuer_url, "http://localhost:5000")
  @jwks_url "#{@issuer_url}/.well-known/jwks.json"

  @doc """
  Verifies and decodes a JWT access token from OpenAuth.

  Returns {:ok, claims} on success where claims contains:
  - type: The subject type (e.g., "user")
  - properties: Map with subject properties (e.g., %{email: "...", external_id: "..."})
  - aud: Audience
  - exp: Expiration timestamp
  - iat: Issued at timestamp

  Returns {:error, reason} on failure.
  """
  @spec verify_token(String.t()) :: {:ok, map()} | {:error, atom() | String.t()}
  def verify_token(token) do
    with {:ok, jwks} <- fetch_jwks(),
         {:ok, header} <- peek_token_header(token),
         {:ok, key} <- find_key(jwks, header),
         {:ok, claims} <- verify_with_key(token, key) do
      {:ok, claims}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Fetches the JWKS (JSON Web Key Set) from the OpenAuth issuer.
  """
  @spec fetch_jwks() :: {:ok, map()} | {:error, term()}
  def fetch_jwks do
    case Req.get(@jwks_url) do
      {:ok, %{status: 200, body: body}} ->
        {:ok, body}

      {:ok, %{status: status}} ->
        Logger.error("Failed to fetch JWKS: HTTP #{status}")
        {:error, :jwks_fetch_failed}

      {:error, reason} ->
        Logger.error("Failed to fetch JWKS: #{inspect(reason)}")
        {:error, :jwks_fetch_failed}
    end
  end

  # Peek at the token header to get the key ID (kid)
  defp peek_token_header(token) do
    case String.split(token, ".") do
      [header_b64, _payload_b64, _signature_b64] ->
        case Base.url_decode64(header_b64, padding: false) do
          {:ok, header_json} ->
            case Jason.decode(header_json) do
              {:ok, header} -> {:ok, header}
              {:error, _} -> {:error, :invalid_token_header}
            end

          :error ->
            {:error, :invalid_token_encoding}
        end

      _ ->
        {:error, :invalid_token_format}
    end
  end

  # Find the appropriate key from JWKS based on the token's kid
  defp find_key(jwks, header) do
    kid = Map.get(header, "kid")

    case Map.get(jwks, "keys", []) do
      [] ->
        {:error, :no_keys_in_jwks}

      keys ->
        # If kid is specified in token, find matching key
        # Otherwise, use the first key
        key =
          if kid do
            Enum.find(keys, fn k -> Map.get(k, "kid") == kid end)
          else
            List.first(keys)
          end

        case key do
          nil -> {:error, :key_not_found}
          k -> {:ok, k}
        end
    end
  end

  # Verify the token using the selected key
  defp verify_with_key(token, jwk) do
    try do
      # Convert JWK to a format Joken can use
      signer = jwk_to_signer(jwk)

      # Verify and decode the token
      case Joken.verify(token, signer) do
        {:ok, claims} ->
          # Validate expiration
          current_time = System.system_time(:second)

          if Map.get(claims, "exp", 0) > current_time do
            {:ok, claims}
          else
            {:error, :token_expired}
          end

        {:error, reason} ->
          Logger.error("Token verification failed: #{inspect(reason)}")
          {:error, :invalid_token}
      end
    rescue
      e ->
        Logger.error("Error verifying token: #{inspect(e)}")
        {:error, :verification_failed}
    end
  end

  # Convert JWK to Joken signer
  defp jwk_to_signer(jwk) do
    alg = Map.get(jwk, "alg", "RS512")

    case Map.get(jwk, "kty") do
      "RSA" ->
        Joken.Signer.create(alg, jwk)

      "EC" ->
        Joken.Signer.create(alg, jwk)

      _ ->
        raise "Unsupported key type"
    end
  end

  @doc """
  Extracts user information from verified token claims.

  Returns {:ok, %{email: email, external_id: external_id}} on success.
  """
  @spec extract_user_info(map()) :: {:ok, map()} | {:error, :invalid_claims}
  def extract_user_info(claims) do
    with type when type == "user" <- Map.get(claims, "type"),
         properties when is_map(properties) <- Map.get(claims, "properties"),
         email when is_binary(email) <- Map.get(properties, "email") do
      external_id =
        case Map.get(properties, "external_id") do
          nil -> Map.get(claims, "sub", "")
          "" -> Map.get(claims, "sub", "")
          id -> id
        end

      Logger.debug("Extracted user info - email: #{email}, external_id: #{external_id}")

      {:ok,
       %{
         email: email,
         external_id: external_id
       }}
    else
      result ->
        Logger.warning("Failed to extract user info. Result: #{inspect(result)}, Claims: #{inspect(claims)}")
        {:error, :invalid_claims}
    end
  end
end
