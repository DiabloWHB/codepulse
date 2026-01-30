# Production Readiness Analyzer - User Guide

## What It Detects

### 1. 🎭 Mock/Test Data

#### Variable Names
Warns about variables with suspicious names:
```tsx
const mockUsers = [...];        // ⚠️ WARNING
const dummyData = [...];        // ⚠️ WARNING
const fakeAPI = "...";          // ⚠️ WARNING
const testData = [...];         // ⚠️ WARNING
const placeholderImage = "..."; // ⚠️ WARNING
const sampleText = "...";       // ⚠️ WARNING
const tempValue = 123;          // ⚠️ WARNING
```

#### Test Values
Detects common placeholder values:
```tsx
email: "test@example.com"       // ℹ️ INFO
name: "John Doe"                // ℹ️ INFO
phone: "123-456-7890"           // ℹ️ INFO
text: "Lorem ipsum..."          // ℹ️ INFO
password: "password123"         // ℹ️ INFO
```

#### TODO Comments
Finds comments indicating temporary code:
```tsx
// TODO: replace with real data      // ⚠️ WARNING
// TODO: remove mock data             // ⚠️ WARNING
// Temporary placeholder              // ⚠️ WARNING
// For testing only                   // ⚠️ WARNING
// This is not real data              // ⚠️ WARNING
```

---

### 2. 🔘 Inactive Buttons

#### No Click Handler
```tsx
<button>Click Me</button>
// ⚠️ WARNING: Button has no onClick handler

<Button label="Submit" />
// ⚠️ WARNING: Button does nothing when clicked
```

#### Empty Handler
```tsx
<button onClick={}>Submit</button>
// ❌ ERROR: onClick handler is empty

<button onClick={undefined}>Submit</button>
// ❌ ERROR: onClick is undefined
```

#### Valid Buttons (No Warning)
```tsx
<button onClick={handleClick}>Submit</button>  // ✅ OK
<button type="submit">Submit</button>          // ✅ OK (form submit)
<button disabled>Submit</button>               // ✅ OK (disabled)
```

---

### 3. 💥 Broken Event Handlers

#### Undefined Function
```tsx
// No function 'handleSubmit' defined in file
<button onClick={handleSubmit}>Submit</button>
// ❌ ERROR: Function 'handleSubmit' is not defined

// But this is OK if imported:
import { handleSubmit } from './handlers';
<button onClick={handleSubmit}>Submit</button>  // ✅ OK
```

---

## Severity Levels

| Severity | Icon | Meaning |
|----------|------|---------|
| **ERROR** | 🔴 | Critical issue - will cause runtime errors |
| **WARNING** | 🟡 | Should be fixed before production |
| **INFO** | ℹ️ | Might be OK, but verify it's intentional |

---

## How to Use

### 1. Automatic Analysis
The analyzer runs automatically on all `.tsx` and `.jsx` files when you:
- Open a file
- Save a file
- Run `CodePulse: Analyze Current File`

### 2. View Issues

#### In Health Status View
1. Click CodePulse icon in Activity Bar
2. Expand "Health Status"
3. See functions with warnings/errors

#### In Problems Panel
1. Press `Ctrl+Shift+M`
2. See all issues from CodePulse
3. Click to jump to problem location

#### In Code Editor
- Squiggly underlines appear under problematic code
- Hover to see issue description

---

## Examples

### Before (Issues Detected)
```tsx
export default function UserProfile() {
  const mockUser = {
    name: "John Doe",          // ℹ️ Test value
    email: "test@example.com"  // ℹ️ Test value
  };

  const tempData = [...];      // ⚠️ Mock variable name

  // TODO: replace with real API call  // ⚠️ Temporary comment
  const fetchUser = () => {};

  return (
    <div>
      <h1>{mockUser.name}</h1>

      {/* ⚠️ Inactive button */}
      <button>Edit Profile</button>

      {/* ❌ Undefined function */}
      <button onClick={saveProfile}>Save</button>
    </div>
  );
}
```

### After (Issues Fixed)
```tsx
export default function UserProfile() {
  const [user, setUser] = useState(null);

  const fetchUser = async () => {
    const response = await fetch('/api/user');
    const data = await response.json();
    setUser(data);
  };

  const handleEdit = () => {
    // Navigate to edit page
  };

  const handleSave = async () => {
    // Save user data
  };

  return (
    <div>
      <h1>{user?.name}</h1>
      <button onClick={handleEdit}>Edit Profile</button>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

---

## Configuration

To disable specific checks, you can add configuration in the future.
Currently, all checks are enabled by default for `.tsx` and `.jsx` files.

---

## Tips

1. **Mock data is OK in development** - These warnings help you remember to replace it before production
2. **Use meaningful names** - Instead of `mockUsers`, use `users` and add a comment
3. **Test values in tests are fine** - The analyzer only runs on component files
4. **Imported handlers are safe** - The analyzer won't warn about imported functions

---

## What's NOT Detected

- Mock data in `.test.tsx` files (test files are OK to have mocks)
- Storybook stories (`.stories.tsx`)
- Comments that don't match the patterns
- Data fetching from APIs (we assume API data is real)

---

Ready to make your code production-ready! 🚀
