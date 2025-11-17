defmodule CatatanBackend.Hash.ArgonTest do
  use ExUnit.Case, async: true

  alias CatatanBackend.Hash.Argon

  describe "hash_value/1" do
    test "returns a hashed string for valid input" do
      password = "my_secure_password"
      hashed = Argon.hash_value(password)

      assert is_binary(hashed)
      assert String.starts_with?(hashed, "$argon2")
      assert hashed != password
    end

    test "generates different hashes for the same password" do
      password = "same_password"
      hash1 = Argon.hash_value(password)
      hash2 = Argon.hash_value(password)

      # Hashes should be different due to different salts
      assert hash1 != hash2
    end

    test "handles empty string" do
      # This tests current behavior - may want to add validation later
      assert_raise FunctionClauseError, fn ->
        Argon.hash_value("")
      end
    end

    test "handles special characters" do
      password = "p@ssw0rd!#$%^&*()"
      hashed = Argon.hash_value(password)

      assert is_binary(hashed)
      assert String.starts_with?(hashed, "$argon2")
    end

    test "handles unicode characters" do
      password = "пароль密码🔐"
      hashed = Argon.hash_value(password)

      assert is_binary(hashed)
      assert String.starts_with?(hashed, "$argon2")
    end

    test "handles long passwords" do
      password = String.duplicate("a", 1000)
      hashed = Argon.hash_value(password)

      assert is_binary(hashed)
      assert String.starts_with?(hashed, "$argon2")
    end
  end

  describe "verify_value/2" do
    test "returns true for correct password" do
      password = "correct_password"
      hashed = Argon.hash_value(password)

      assert Argon.verify_value(password, hashed) == true
    end

    test "returns false for incorrect password" do
      password = "correct_password"
      hashed = Argon.hash_value(password)

      assert Argon.verify_value("wrong_password", hashed) == false
    end

    test "returns false for empty password against valid hash" do
      password = "correct_password"
      hashed = Argon.hash_value(password)

      assert Argon.verify_value("", hashed) == false
    end

    test "verifies password with special characters" do
      password = "p@ssw0rd!#$%^&*()"
      hashed = Argon.hash_value(password)

      assert Argon.verify_value(password, hashed) == true
      assert Argon.verify_value("p@ssw0rd", hashed) == false
    end

    test "verifies password with unicode characters" do
      password = "пароль密码🔐"
      hashed = Argon.hash_value(password)

      assert Argon.verify_value(password, hashed) == true
      assert Argon.verify_value("пароль", hashed) == false
    end

    test "returns false for malformed hash" do
      password = "some_password"
      malformed_hash = "not_a_valid_hash"

      # This tests current behavior - may want to handle errors explicitly
      assert Argon.verify_value(password, malformed_hash) == false
    end

    test "handles case sensitivity correctly" do
      password = "Password123"
      hashed = Argon.hash_value(password)

      assert Argon.verify_value("Password123", hashed) == true
      assert Argon.verify_value("password123", hashed) == false
      assert Argon.verify_value("PASSWORD123", hashed) == false
    end
  end

  describe "hash and verify integration" do
    test "full cycle of hashing and verification works" do
      passwords = [
        "simple",
        "with spaces",
        "with-dashes-and_underscores",
        "1234567890",
        "MixedCasePassword123!",
        "very_long_password_" <> String.duplicate("x", 100)
      ]

      for password <- passwords do
        hashed = Argon.hash_value(password)
        assert Argon.verify_value(password, hashed) == true
        assert Argon.verify_value(password <> "x", hashed) == false
      end
    end

    test "different passwords produce different hashes that don't cross-verify" do
      password1 = "password_one"
      password2 = "password_two"

      hash1 = Argon.hash_value(password1)
      hash2 = Argon.hash_value(password2)

      assert hash1 != hash2
      assert Argon.verify_value(password1, hash1) == true
      assert Argon.verify_value(password1, hash2) == false
      assert Argon.verify_value(password2, hash1) == false
      assert Argon.verify_value(password2, hash2) == true
    end
  end
end
