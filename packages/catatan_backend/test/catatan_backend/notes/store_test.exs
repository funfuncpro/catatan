defmodule CatatanBackend.Notes.StoreTest do
  use ExUnit.Case, async: false

  alias CatatanBackend.Notes.{Store, NoteCrdt, Lww}
  alias CatatanBackend.GenerateID

  setup do
    # Generate unique IDs for each test to avoid conflicts
    note_id = GenerateID.generate_nano_id()
    replica_id = "test_replica_#{:rand.uniform(10000)}"

    {:ok, note_id: note_id, replica_id: replica_id}
  end

  describe "encrypted note creation" do
    test "creates a note with encrypted content in database", %{
      note_id: note_id,
      replica_id: replica_id
    } do
      content = "This is a secret note"
      clock = 1

      # Create encrypted note
      assert {:ok, note} = Store.upsert(note_id, replica_id, clock, content)

      # Verify note structure
      assert note.note_id == note_id
      assert NoteCrdt.get_body(note) == content
      assert NoteCrdt.current_clock(note) == clock

      # Verify data is encrypted in database by reading raw data
      query = "SELECT body FROM notes_lww WHERE note_id = ? AND replica_id = ? AND clock = ?"

      assert {:ok, prepared} =
               CatatanBackend.CassandraClient.prepare(query)

      assert {:ok, page} =
               CatatanBackend.CassandraClient.execute(prepared, %{
                 "note_id" => note_id,
                 "replica_id" => to_string(replica_id),
                 "clock" => clock
               })

      [row] = Enum.to_list(page)
      encrypted_body = row["body"]

      # Encrypted data should not equal plaintext
      assert encrypted_body != content

      # Encrypted data should be at least 28 bytes (IV + Tag minimum)
      assert byte_size(encrypted_body) >= 28

      # Should not be valid UTF-8 text (it's binary)
      refute String.valid?(encrypted_body)
    end

    test "creates multiple replicas with different encrypted values", %{
      note_id: note_id
    } do
      content = "Shared content"

      replica_1 = "replica_1"
      replica_2 = "replica_2"

      # Create two replicas with same content
      assert {:ok, _note1} = Store.upsert(note_id, replica_1, 1, content)
      assert {:ok, _note2} = Store.upsert(note_id, replica_2, 1, content)

      # Read raw encrypted data for both
      query = "SELECT replica_id, body FROM notes_lww WHERE note_id = ?"

      assert {:ok, prepared} = CatatanBackend.CassandraClient.prepare(query)
      assert {:ok, page} = CatatanBackend.CassandraClient.execute(prepared, %{"note_id" => note_id})

      rows = Enum.to_list(page)
      assert length(rows) == 2

      # Extract encrypted bodies
      encrypted_bodies = Enum.map(rows, & &1["body"])

      # Both should be encrypted (different IVs = different ciphertext)
      [enc1, enc2] = encrypted_bodies
      assert enc1 != enc2  # Different IVs make ciphertexts different
      assert enc1 != content
      assert enc2 != content
    end
  end

  describe "encrypted note retrieval" do
    test "retrieves and decrypts a single replica note", %{
      note_id: note_id,
      replica_id: replica_id
    } do
      content = "My encrypted note"
      clock = 1

      # Store encrypted note
      assert {:ok, _stored_note} = Store.upsert(note_id, replica_id, clock, content)

      # Retrieve and verify decryption
      assert {:ok, retrieved_note} = Store.get(note_id)

      assert retrieved_note.note_id == note_id
      assert NoteCrdt.get_body(retrieved_note) == content
      assert NoteCrdt.current_clock(retrieved_note) == clock
    end

    test "retrieves and decrypts large content", %{
      note_id: note_id,
      replica_id: replica_id
    } do
      # Create 10KB content
      large_content = String.duplicate("Lorem ipsum dolor sit amet. ", 350)
      clock = 1

      assert {:ok, _stored_note} = Store.upsert(note_id, replica_id, clock, large_content)
      assert {:ok, retrieved_note} = Store.get(note_id)

      assert NoteCrdt.get_body(retrieved_note) == large_content
      assert byte_size(NoteCrdt.get_body(retrieved_note)) > 10000
    end

    test "returns error for non-existent note", %{note_id: note_id} do
      non_existent_id = "#{note_id}_does_not_exist"

      assert {:error, :not_found} = Store.get(non_existent_id)
    end
  end

  describe "replica merging with encrypted data" do
    test "merges multiple encrypted replicas correctly", %{note_id: note_id} do
      # Create multiple replicas with different clocks
      assert {:ok, _note1} = Store.upsert(note_id, "replica_1", 1, "First version")
      assert {:ok, _note2} = Store.upsert(note_id, "replica_2", 2, "Second version")
      assert {:ok, _note3} = Store.upsert(note_id, "replica_3", 3, "Third version")

      # Retrieve and verify LWW merge
      assert {:ok, merged_note} = Store.get(note_id)

      # Should use highest clock (replica_3, clock 3)
      assert NoteCrdt.get_body(merged_note) == "Third version"
      assert NoteCrdt.current_clock(merged_note) == 3
    end

    test "merges replicas with same clock using replica_id tiebreaker", %{
      note_id: note_id
    } do
      # Create replicas with same clock
      assert {:ok, _note1} = Store.upsert(note_id, "replica_a", 5, "Version A")
      assert {:ok, _note2} = Store.upsert(note_id, "replica_z", 5, "Version Z")

      assert {:ok, merged_note} = Store.get(note_id)

      # Should use lexicographically greater replica_id ("replica_z" > "replica_a")
      assert NoteCrdt.get_body(merged_note) == "Version Z"
      assert NoteCrdt.current_clock(merged_note) == 5
    end

    test "merges encrypted replicas with unicode content", %{note_id: note_id} do
      unicode_content_1 = "你好世界 🌍"
      unicode_content_2 = "مرحبا بالعالم 🚀"
      unicode_content_3 = "Привет мир 🎉"

      assert {:ok, _note1} = Store.upsert(note_id, "replica_1", 1, unicode_content_1)
      assert {:ok, _note2} = Store.upsert(note_id, "replica_2", 3, unicode_content_2)
      assert {:ok, _note3} = Store.upsert(note_id, "replica_3", 2, unicode_content_3)

      assert {:ok, merged_note} = Store.get(note_id)

      # Clock 3 wins
      assert NoteCrdt.get_body(merged_note) == unicode_content_2
    end
  end

  describe "concurrent writes" do
    test "handles concurrent encrypted writes safely", %{note_id: note_id} do
      # Simulate concurrent writes from different replicas
      tasks =
        Enum.map(1..10, fn i ->
          Task.async(fn ->
            Store.upsert(note_id, "replica_#{i}", i, "Content #{i}")
          end)
        end)

      # Wait for all writes to complete
      results = Task.await_many(tasks, 5000)

      # All writes should succeed
      assert Enum.all?(results, fn
               {:ok, _note} -> true
               _ -> false
             end)

      # Retrieve merged result
      assert {:ok, merged_note} = Store.get(note_id)

      # Should have highest clock (10)
      assert NoteCrdt.current_clock(merged_note) == 10
      assert NoteCrdt.get_body(merged_note) == "Content 10"
    end

    test "handles concurrent updates to same replica", %{note_id: note_id} do
      replica_id = "shared_replica"

      # Multiple concurrent updates to same replica
      tasks =
        Enum.map(1..5, fn i ->
          Task.async(fn ->
            Store.upsert(note_id, replica_id, i, "Update #{i}")
          end)
        end)

      results = Task.await_many(tasks, 5000)

      # All should succeed
      assert Enum.all?(results, fn
               {:ok, _} -> true
               _ -> false
             end)

      # Retrieve and verify
      assert {:ok, note} = Store.get(note_id)

      # Should have the highest clock
      assert NoteCrdt.current_clock(note) == 5
    end
  end

  describe "encryption roundtrip" do
    test "encrypted content survives multiple upsert/get cycles", %{
      note_id: note_id,
      replica_id: replica_id
    } do
      original_content = "Test content for roundtrip"

      # Cycle 1: Write and read
      assert {:ok, _} = Store.upsert(note_id, replica_id, 1, original_content)
      assert {:ok, note1} = Store.get(note_id)
      assert NoteCrdt.get_body(note1) == original_content

      # Cycle 2: Update and read
      updated_content = "Updated content"
      assert {:ok, _} = Store.upsert(note_id, replica_id, 2, updated_content)
      assert {:ok, note2} = Store.get(note_id)
      assert NoteCrdt.get_body(note2) == updated_content

      # Cycle 3: Another update
      final_content = "Final content"
      assert {:ok, _} = Store.upsert(note_id, replica_id, 3, final_content)
      assert {:ok, note3} = Store.get(note_id)
      assert NoteCrdt.get_body(note3) == final_content
    end

    test "handles empty string encryption", %{note_id: note_id, replica_id: replica_id} do
      empty_content = ""

      assert {:ok, _} = Store.upsert(note_id, replica_id, 1, empty_content)
      assert {:ok, note} = Store.get(note_id)

      assert NoteCrdt.get_body(note) == empty_content
    end

    test "handles special characters and newlines", %{
      note_id: note_id,
      replica_id: replica_id
    } do
      special_content = """
      # Title with special chars: @#$%^&*()

      - Line 1 with "quotes"
      - Line 2 with 'single quotes'
      - Line 3 with `backticks`

      Code block:
      ```
      def hello() do
        IO.puts("world")
      end
      ```

      More special: <html>tags</html>, [links](http://example.com)
      """

      assert {:ok, _} = Store.upsert(note_id, replica_id, 1, special_content)
      assert {:ok, note} = Store.get(note_id)

      assert NoteCrdt.get_body(note) == special_content
    end
  end
end
