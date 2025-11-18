defmodule CatatanBackend.ApiKey.GenerateTest do
  use ExUnit.Case, async: true

  alias CatatanBackend.ApiKey.Generate

  describe "generate_api_key/2" do
    test "generates API key with valid id and key strings" do
      id = "user123"
      key = "abc456def"

      result = Generate.generate_api_key(id, key)

      assert result == "catatan_user123:abc456def"
    end

    test "generates API key with empty strings" do
      id = ""
      key = ""

      result = Generate.generate_api_key(id, key)

      assert result == "catatan_:"
    end

    test "generates API key with special characters in id and key" do
      id = "user@123!#"
      key = "key$%^&*()"

      result = Generate.generate_api_key(id, key)

      assert result == "catatan_user@123!#:key$%^&*()"
    end

    test "always follows the format catatan_{id}:{key}" do
      id = "test_id"
      key = "test_key"

      result = Generate.generate_api_key(id, key)

      assert String.starts_with?(result, "catatan_")
      assert String.contains?(result, ":")
      assert result == "catatan_#{id}:#{key}"
    end

    test "handles ids and keys with colons" do
      id = "id:with:colons"
      key = "key:with:colons"

      result = Generate.generate_api_key(id, key)

      assert result == "catatan_id:with:colons:key:with:colons"
    end

    test "handles ids and keys with underscores" do
      id = "id_with_underscores"
      key = "key_with_underscores"

      result = Generate.generate_api_key(id, key)

      assert result == "catatan_id_with_underscores:key_with_underscores"
    end
  end

  describe "generate_random_key/0" do
    test "generates a non-empty string" do
      result = Generate.generate_random_key()

      assert is_binary(result)
      assert String.length(result) > 0
    end

    test "generates a Base64 encoded string" do
      result = Generate.generate_random_key()

      # Base64 should only contain valid characters
      assert String.match?(result, ~r/^[A-Za-z0-9+\/=]+$/)
    end

    test "generates unique keys on multiple calls" do
      key1 = Generate.generate_random_key()
      key2 = Generate.generate_random_key()
      key3 = Generate.generate_random_key()

      assert key1 != key2
      assert key2 != key3
      assert key1 != key3
    end

    test "generates keys with consistent length (32 bytes = ~44 chars Base64)" do
      key1 = Generate.generate_random_key()
      key2 = Generate.generate_random_key()
      key3 = Generate.generate_random_key()

      # 32 bytes encoded in Base64 results in 44 characters
      assert String.length(key1) == 44
      assert String.length(key2) == 44
      assert String.length(key3) == 44
    end

    test "generated key can be decoded back to 32 bytes" do
      result = Generate.generate_random_key()

      {:ok, decoded} = Base.decode64(result)
      assert byte_size(decoded) == 32
    end
  end
end
