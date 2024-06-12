const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000

// middleware
app.use(express.json())
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://blood-found-513a1.web.app",
        "https://blood-found-513a1.firebaseapp.com",
      ]
}))


// mongodb data  [change this data]
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7mjs11j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const userCollection = client.db('BloodFound').collection('users');
        const districtCollection = client.db('BloodFound').collection('district');
        const upazilaCollection = client.db('BloodFound').collection('upazila');
        const donationCollection = client.db('BloodFound').collection('donation');
        const blogCollection = client.db('BloodFound').collection('blog');


        // jwt token api making related
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            // console.log("the token is ",token);
            res.send({ token })
        })
        // middleware
        const verifyToken = (req, res, next) => {
            console.log("inserted token", req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next()
            })
        }
        // admin verify
        const adminVerify = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role == 'admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            next()
        }

        // user get req.
        app.get('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })
        // user data get only admin
        app.get('/users', verifyToken, adminVerify, async (req, res) => {
            const filter = req.query.filter;
            // console.log(filter);
            let query = {}
            if (filter) query = { status: filter }
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/usersRole/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const options = {
                projection: { role: 1, _id: 0 },
            }
            const result = await userCollection.findOne(query, options)
            res.send(result)
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            const existingEmail = await userCollection.findOne(query)
            if (existingEmail) {
                return res.send({ message: 'The User already existing', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        // user data update
        app.patch('/users/:email', async (req, res) => {
            const user = req.body;
            const email = req.params.email;
            const query = { email: email }
            const optional = { upsert: true }
            const updateDoc = {
                $set: {
                    ...user
                }
            }
            const result = await userCollection.updateOne(query, updateDoc, optional)
            res.send(result)
        })
        // donation all api 
        // admin data fetch
        app.get('/donation', verifyToken, async (req, res) => {
            const result = await donationCollection.find().toArray()
            res.send(result)
        })

        app.get('/donationDetails/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donationCollection.findOne(query)
            res.send(result)
        })

        app.patch('/donationDetails/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...data
                }
            }
            const result = await donationCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        app.delete('/donationDelete/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await donationCollection.deleteOne(query)
            res.send(result)
        })

        // specific user data get api
        app.get('/donation/:email', async (req, res) => {
            const email = req.params.email;
            const body = req.query.filter;
            const query = { email: email }
            if (body){ 
                query.status = body
             }
            const result = await donationCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/donation', async (req, res) => {
            const donation = req.body;
            const result = await donationCollection.insertOne(donation)
            res.send(result)
        })

        // upazila and district data load
        app.get('/district', async (req, res) => {
            const result = await districtCollection.find().toArray()
            res.send(result)
        })
        app.get('/upazila', async (req, res) => {
            const result = await upazilaCollection.find().toArray()
            res.send(result)
        })

        // admin all api
        // admin stats
        app.get('/admin-stats', verifyToken, async (req, res) => {
            const user = await userCollection.estimatedDocumentCount()
            const totalDonationRequest = await donationCollection.estimatedDocumentCount()
            res.send({ user, totalDonationRequest })
        })
        // public stats
        app.get('/public-stats',async(req,res)=>{
            const user = await userCollection.estimatedDocumentCount()
            const district = await districtCollection.estimatedDocumentCount()
            const upazile = await upazilaCollection.estimatedDocumentCount()
            const blog = await blogCollection.estimatedDocumentCount()
            res.send({user,district,upazile,blog})
        })

        // blog fetch
        app.get('/blog', async (req, res) => {
            const filter = req.query.filter;
            // console.log(filter);
            let query = {}
            if (filter) query = { status: filter }
            const result = await blogCollection.find(query).toArray()
            res.send(result)
        })

        // blog post api
        app.post('/blog', async (req, res) => {
            const body = req.body;
            // console.log("the blog", body);
            const result = await blogCollection.insertOne(body)
            res.send(result)
        })

        app.patch('/blog/:id', verifyToken, adminVerify, async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            // console.log(id);
            // console.log("status", status);
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...status
                }
            }
            const result = await blogCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        // blog delete 
        app.delete('/blog/:id', verifyToken, adminVerify, async (req, res) => {
            const id = req.params.id;
            const email = req.decoded.email
            // console.log("decode", email);

            const filter = { email: email }
            const user = await userCollection.findOne(filter)
            let result
            if (user?.role == "admin") {
                const query = { _id: new ObjectId(id) }
                result = await blogCollection.deleteOne(query)
            }
            res.send(result)
        })
        // publish blog api
        app.get('/blogShow', async (req, res) => {
            const query = { status: 'published' }
            const result = await blogCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/blogShow/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await blogCollection.findOne(query)
            res.send(result)
        })

        // this is admin check ,
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            const query = { email: email }
            // console.log(query);
            const user = await userCollection.findOne(query)
            // console.log(user?.role);
            let admin = false
            if (user) {
                admin = user.role === 'admin'
            }
            res.send({ admin })
        })
        // Volunteer check

        app.get('/users/volunteer/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            const query = { email: email }
            // console.log(query);
            const user = await userCollection.findOne(query)
            // console.log(user?.role);
            let volunteer;
            if (user) {
                volunteer = user.role == 'volunteer'
            }
            res.send({ volunteer })
        })

        // TODO: must use verifyToken, adminVerify
        // user status change
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...status
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        // volunteer make
        app.patch('/users_role/admin/:id', async (req, res) => {
            const id = req.params.id;
            const admin = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...admin
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        // volunteer do status change
        app.patch('/volunteer-role/:id', async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...body
                }
            }
            const result = await donationCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        app.patch('/users_admin_role/admin/:id', async (req, res) => {
            const id = req.params.id;
            const volunteer = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...volunteer
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        // public data 
        app.get('/donationStatus', async (req, res) => {
            const query = { status: 'pending' }
            const result = await donationCollection.find(query).toArray()
            res.send(result)
        })
        // public single data 
        app.get('/donationStatus/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCollection.findOne(query);
            res.send(result);
        })
        // donate a user blood 
        app.patch('/donated/:id', async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const query = { _id: new ObjectId(id) }
            const filter = { upsert: true }
            const updateDoc = {
                $set: {
                    ...body
                }
            }
            const result = await donationCollection.updateOne(query, updateDoc, filter)
            res.send(result)
        })
        // donation done
        app.patch('/donationDone/:id', async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...body
                }
            }
            const result = await donationCollection.updateOne(query, updateDoc)
            res.send(result)
        })
        // donation delete
        app.patch('/donationCanceled/:id', async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...body
                }
            }
            const result = await donationCollection.updateOne(query, updateDoc)
            res.send(result)
        })
        // user updated data show 
        app.get('/update-user-data/:email',async(req,res)=>{
            const email = req.params.email;
            const query = {email: email}
            const option = {
                projection: {
                    _id: 0, name: 1, photo: 1
                }
            }
            const result = await userCollection.findOne(query,option)
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// server
app.get('/', (req, res) => {
    res.send('the server is running........')
})
app.listen(port, () => {
    console.log(`the blood found server running on the port: ${port}`);
})
