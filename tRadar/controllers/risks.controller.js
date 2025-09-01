const express = require('express'),
    router = express.Router(),
    service = require('../services/risks.service')

// Here, get req will look like http://localhost:4000/api/risks/   
router.get('/', async (req, res) => {
    const risks = await service.getAllRisks()
    res.send(risks)
})

// Get a risk by its ID
router.get('/:id', async (req, res) => {
    const risk = await service.getRiskByID(req.params.id)
    if (risk === undefined)
        res.status(404).json('No Risk Found With The Given ID: ' + req.params.id)
    else
        res.send(risk)
})

// Delete a risk
router.delete('/:id', async (req, res) => {
    const affectedRows = await service.deleteRisk(req.params.id)
    if (affectedRows === 0)
        res.status(404).json('No Risk Found With The Given ID: ' + req.params.id)
    else
        res.send('Deleted the risk successfully!')
})

// Add a risk
router.post('/', async (req, res) => {
    const affectedRows = await service.addOrEditRisk(req.body)
    res.status(201).send('Risk added successfully!')
})

// Update a risk
router.put('/:id', async (req, res) => {
    const affectedRows = await service.addOrEditRisk(req.body, req.params.id)
    if (affectedRows === 0)
        res.status(404).json('No Risk Found With The Given ID: ' + req.params.id)
    else
        res.send('Updated the risk successfully!')
})

module.exports = router; 