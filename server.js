const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your-very-secure-secret';

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500']
}));

app.use(express.json());


let users = [
    { id: 1, username: 'admin@example.com', email: 'admin@example.com', firstName: 'Admin', lastName: 'User', password: '', role: 'admin', verified: true },
    { id: 2, username: 'alice@example.com', email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith', password: '', role: 'user', verified: true }
];


if (!users[0].password.includes('$2a$')) {
    users[0].password = bcrypt.hashSync('admin123', 10);
    users[1].password = bcrypt.hashSync('user123', 10);
}


let departments = [
    { id: 1, name: 'Engineering', description: 'Software team' },
    { id: 2, name: 'HR', description: 'Human Resources' }
];
let employees = [];
let requests = [];
let nextUserId = 3;



app.post('/api/register', async (req, res) => {
    const { firstName, lastName, username, email, password, role = 'user' } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const existing = users.find(u => u.email === email);
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: nextUserId++,
        username: username || email,
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        password: hashedPassword,
        role: users.length === 0 ? 'admin' : role,
        verified: false,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    res.status(201).json({ message: 'User registered', email, role: newUser.role });
});

// Simulate email verification (for demo)
app.post('/api/verify', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.verified = true;
    res.json({ message: 'Email verified' });
});

app.post('/api/login', async (req, res) => {
    
    const { username, email, password } = req.body;
    const identifier = username || email;

    console.log('LOGIN ATTEMPT - body:', req.body);
    console.log('LOGIN ATTEMPT - identifier:', identifier);
    console.log('LOGIN ATTEMPT - users in db:', users.map(u => ({ email: u.email, username: u.username })));

    const user = users.find(u => u.email === identifier || u.username === identifier);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.verified) return res.status(401).json({ error: 'Please verify your email first' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        SECRET_KEY,
        { expiresIn: '1h' }
    );

    res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isAdmin: user.role === 'admin'
        }
    });
});

app.get('/api/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password, ...safeUser } = user;
    res.json({ user: { ...safeUser, isAdmin: safeUser.role === 'admin' } });
});

app.put('/api/profile', authenticateToken, async (req, res) => {
    const { firstName, lastName, password } = req.body;
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (password && password.length >= 6) {
        user.password = await bcrypt.hash(password, 10);
    }

    const { password: _, ...safeUser } = user;
    res.json({ user: { ...safeUser, isAdmin: safeUser.role === 'admin' } });
});



app.get('/api/accounts', authenticateToken, authorizeRole('admin'), (req, res) => {
    const safeUsers = users.map(({ password, ...u }) => ({ ...u, isAdmin: u.role === 'admin' }));
    res.json(safeUsers);
});

app.post('/api/accounts', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { firstName, lastName, email, password, role, verified } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already exists' });

    const newUser = {
        id: nextUserId++,
        username: email,
        email, firstName, lastName,
        password: await bcrypt.hash(password, 10),
        role: role || 'user',
        verified: verified || false,
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    const { password: _, ...safeUser } = newUser;
    res.status(201).json({ ...safeUser, isAdmin: safeUser.role === 'admin' });
});

app.put('/api/accounts/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { firstName, lastName, email, password, role, verified } = req.body;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (verified !== undefined) user.verified = verified;
    if (password && password.length >= 6) user.password = await bcrypt.hash(password, 10);

    const { password: _, ...safeUser } = user;
    res.json({ ...safeUser, isAdmin: safeUser.role === 'admin' });
});

app.delete('/api/accounts/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = parseInt(req.params.id);
    if (req.user.id === id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(idx, 1);
    res.json({ message: 'Account deleted' });
});

app.post('/api/accounts/:id/reset-password', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password too short' });
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = await bcrypt.hash(password, 10);
    res.json({ message: 'Password reset successfully' });
});



app.get('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
    res.json(employees);
});

app.post('/api/employees', authenticateToken, authorizeRole('admin'), (req, res) => {
    const { employeeId, email, position, department, hireDate } = req.body;
    if (employees.find(e => e.employeeId === employeeId)) {
        return res.status(409).json({ error: 'Employee ID already exists' });
    }
    const emp = { employeeId, email, position, department, hireDate };
    employees.push(emp);
    res.status(201).json(emp);
});

app.put('/api/employees/:employeeId', authenticateToken, authorizeRole('admin'), (req, res) => {
    const idx = employees.findIndex(e => e.employeeId === req.params.employeeId);
    if (idx === -1) return res.status(404).json({ error: 'Employee not found' });
    employees[idx] = { ...employees[idx], ...req.body };
    res.json(employees[idx]);
});

app.delete('/api/employees/:employeeId', authenticateToken, authorizeRole('admin'), (req, res) => {
    const idx = employees.findIndex(e => e.employeeId === req.params.employeeId);
    if (idx === -1) return res.status(404).json({ error: 'Employee not found' });
    employees.splice(idx, 1);
    res.json({ message: 'Employee deleted' });
});



app.get('/api/departments', authenticateToken, (req, res) => {
    res.json(departments);
});

app.post('/api/departments', authenticateToken, authorizeRole('admin'), (req, res) => {
    const dept = { id: Date.now(), name: req.body.name, description: req.body.description };
    departments.push(dept);
    res.status(201).json(dept);
});

app.put('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = parseInt(req.params.id);
    const idx = departments.findIndex(d => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Department not found' });
    departments[idx] = { ...departments[idx], ...req.body, id };
    res.json(departments[idx]);
});

app.delete('/api/departments/:id', authenticateToken, authorizeRole('admin'), (req, res) => {
    const id = parseInt(req.params.id);
    const idx = departments.findIndex(d => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Department not found' });
    departments.splice(idx, 1);
    res.json({ message: 'Department deleted' });
});


app.get('/api/requests', authenticateToken, (req, res) => {
    const userRequests = requests.filter(r => r.employeeEmail === req.user.email);
    res.json(userRequests);
});

app.post('/api/requests', authenticateToken, (req, res) => {
    const { type, items } = req.body;
    const request = {
        id: Date.now(),
        employeeEmail: req.user.email,
        type,
        items,
        status: 'Pending',
        date: new Date().toISOString()
    };
    requests.push(request);
    res.status(201).json(request);
});

app.delete('/api/requests/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id);
    const idx = requests.findIndex(r => r.id === id && r.employeeEmail === req.user.email);
    if (idx === -1) return res.status(404).json({ error: 'Request not found' });
    if (requests[idx].status !== 'Pending') return res.status(400).json({ error: 'Cannot delete non-pending request' });
    requests.splice(idx, 1);
    res.json({ message: 'Request deleted' });
});


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

function authorizeRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Access denied: insufficient permissions' });
        }
        next();
    };
}


app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`Default credentials:`);
    console.log(`  Admin: email=admin@example.com, password=admin123`);
    console.log(`  User:  email=alice@example.com,  password=user123`);
});