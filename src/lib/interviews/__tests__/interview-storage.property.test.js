/**
 * Property-Based Tests for Interview Data Storage
 * Feature: interview-scheduling, Property 3: Data Schema Consistency
 * Feature: interview-scheduling, Property 4: Optional Field Storage
 * Validates: Requirements 2.1, 7.2, 7.3, 2.2, 2.4
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import { getInterviewsCollection } from '../interview-db.js';
import { createInterviewDocument, formatInterviewForDisplay, INTERVIEW_TYPES, INTERVIEW_STATUS, MEETING_TYPES } from '../interview-models.js';

// Helper generators for valid data
const validObjectIdGen = () => fc.string().map(() => new ObjectId().toString());

const validDateGen = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  
  return fc.date({ min: tomorrow, max: oneMonthFromNow })
    .filter(date => !isNaN(date.getTime()))
    .map(date => date.toISOString().split('T')[0]);
};

const validTimeGen = () => fc.integer({ min: 8, max: 17 })
  .chain(hour => fc.integer({ min: 0, max: 59 })
    .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`));

const validInterviewTypeGen = () => fc.constantFrom(...Object.values(INTERVIEW_TYPES));
const validMeetingTypeGen = () => fc.constantFrom(...Object.values(MEETING_TYPES));
const validStatusGen = () => fc.constantFrom(...Object.values(INTERVIEW_STATUS));

const validInterviewerNamesGen = () => fc.array(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 3 }
);

// Generator for complete interview data with all fields
const completeInterviewDataGen = () => fc.record({
  candidateId: validObjectIdGen(),
  candidateName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  jobId: validObjectIdGen(),
  jobTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  date: validDateGen(),
  time: validTimeGen(),
  type: validInterviewTypeGen(),
  duration: fc.integer({ min: 15, max: 480 }).filter(d => d % 15 === 0),
  interviewers: validInterviewerNamesGen(),
  meetingType: validMeetingTypeGen(),
  meetingLink: fc.option(fc.webUrl()),
  location: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  notes: fc.option(fc.string({ maxLength: 500 })),
  status: validStatusGen(),
  createdBy: validObjectIdGen()
});

// Generator for minimal interview data (only required fields)
const minimalInterviewDataGen = () => fc.record({
  candidateId: validObjectIdGen(),
  candidateName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  jobId: validObjectIdGen(),
  jobTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  date: validDateGen(),
  time: validTimeGen(),
  type: validInterviewTypeGen(),
  interviewers: validInterviewerNamesGen()
});

describe('Interview Storage Property Tests', () => {
  let testInterviewIds = [];

  afterEach(async () => {
    // Clean up test interviews
    try {
      if (testInterviewIds.length > 0) {
        const collection = await getInterviewsCollection();
        await collection.deleteMany({ 
          _id: { $in: testInterviewIds.map(id => new ObjectId(id)) }
        });
        testInterviewIds = [];
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Property 3: Data Schema Consistency
   * For any interview document created and stored in the database, the document 
   * should maintain consistent schema structure with all required fields properly 
   * typed and formatted according to the data model specification.
   */
  describe('Property 3: Data Schema Consistency', () => {
    
    test('stored interviews maintain consistent schema structure', () => {
      return fc.assert(
        fc.asyncProperty(
          completeInterviewDataGen(),
          async (interviewData) => {
            // Property: All stored interviews should have consistent schema
            const interviewDoc = createInterviewDocument(interviewData);
            
            const collection = await getInterviewsCollection();
            const result = await collection.insertOne(interviewDoc);
            testInterviewIds.push(result.insertedId.toString());
            
            // Retrieve the stored document
            const storedDoc = await collection.findOne({ _id: result.insertedId });
            
            // Verify schema consistency
            expect(storedDoc).toBeDefined();
            expect(storedDoc._id).toBeInstanceOf(ObjectId);
            expect(storedDoc.candidateId).toBeInstanceOf(ObjectId);
            expect(storedDoc.jobId).toBeInstanceOf(ObjectId);
            expect(typeof storedDoc.candidateName).toBe('string');
            expect(typeof storedDoc.jobTitle).toBe('string');
            expect(storedDoc.scheduledDate).toBeInstanceOf(Date);
            expect(typeof storedDoc.duration).toBe('number');
            expect(typeof storedDoc.type).toBe('string');
            expect(Array.isArray(storedDoc.interviewers)).toBe(true);
            expect(typeof storedDoc.meetingDetails).toBe('object');
            expect(typeof storedDoc.notes).toBe('string');
            expect(typeof storedDoc.status).toBe('string');
            expect(typeof storedDoc.metadata).toBe('object');
            expect(storedDoc.metadata.createdAt).toBeInstanceOf(Date);
            expect(storedDoc.metadata.updatedAt).toBeInstanceOf(Date);
            expect(typeof storedDoc.metadata.isActive).toBe('boolean');
          }
        ),
        { numRuns: 10 }
      );
    });

    test('document fields maintain correct data types after storage', () => {
      return fc.assert(
        fc.asyncProperty(
          completeInterviewDataGen(),
          async (interviewData) => {
            // Property: Data types should be preserved during storage
            const interviewDoc = createInterviewDocument(interviewData);
            
            const collection = await getInterviewsCollection();
            const result = await collection.insertOne(interviewDoc);
            testInterviewIds.push(result.insertedId.toString());
            
            const storedDoc = await collection.findOne({ _id: result.insertedId });
            
            // Verify specific field types match expected schema
            expect(Object.values(INTERVIEW_TYPES)).toContain(storedDoc.type);
            expect(Object.values(INTERVIEW_STATUS)).toContain(storedDoc.status);
            expect(Object.values(MEETING_TYPES)).toContain(storedDoc.meetingDetails.type);
            expect(storedDoc.duration).toBeGreaterThan(0);
            expect(storedDoc.interviewers.every(name => typeof name === 'string')).toBe(true);
            expect(storedDoc.metadata.isActive).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('formatted display data maintains consistency with stored data', () => {
      return fc.assert(
        fc.asyncProperty(
          completeInterviewDataGen(),
          async (interviewData) => {
            // Property: Display formatting should be consistent with stored data
            const interviewDoc = createInterviewDocument(interviewData);
            
            const collection = await getInterviewsCollection();
            const result = await collection.insertOne(interviewDoc);
            testInterviewIds.push(result.insertedId.toString());
            
            const storedDoc = await collection.findOne({ _id: result.insertedId });
            const formattedDoc = formatInterviewForDisplay(storedDoc);
            
            // Verify formatting consistency
            expect(formattedDoc.id).toBe(storedDoc._id.toString());
            expect(formattedDoc.candidateId).toBe(storedDoc.candidateId.toString());
            expect(formattedDoc.jobId).toBe(storedDoc.jobId.toString());
            expect(formattedDoc.candidateName).toBe(storedDoc.candidateName);
            expect(formattedDoc.jobTitle).toBe(storedDoc.jobTitle);
            expect(formattedDoc.type).toBe(storedDoc.type);
            expect(formattedDoc.status).toBe(storedDoc.status);
            expect(formattedDoc.interviewers).toEqual(storedDoc.interviewers);
            
            // Verify date formatting
            const expectedDate = storedDoc.scheduledDate.toISOString().split('T')[0];
            const expectedTime = storedDoc.scheduledDate.toTimeString().slice(0, 5);
            expect(formattedDoc.date).toBe(expectedDate);
            expect(formattedDoc.time).toBe(expectedTime);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 4: Optional Field Storage
   * For any interview document with optional fields (notes, location, meeting link), 
   * the system should correctly store null/empty values and handle missing optional 
   * fields without affecting required field storage or retrieval.
   */
  describe('Property 4: Optional Field Storage', () => {
    
    test('handles missing optional fields gracefully', () => {
      return fc.assert(
        fc.asyncProperty(
          minimalInterviewDataGen(),
          async (interviewData) => {
            // Property: Missing optional fields should not break storage
            const interviewDoc = createInterviewDocument(interviewData);
            
            const collection = await getInterviewsCollection();
            const result = await collection.insertOne(interviewDoc);
            testInterviewIds.push(result.insertedId.toString());
            
            const storedDoc = await collection.findOne({ _id: result.insertedId });
            
            // Verify required fields are present
            expect(storedDoc.candidateId).toBeInstanceOf(ObjectId);
            expect(storedDoc.jobId).toBeInstanceOf(ObjectId);
            expect(storedDoc.candidateName).toBeTruthy();
            expect(storedDoc.jobTitle).toBeTruthy();
            expect(storedDoc.scheduledDate).toBeInstanceOf(Date);
            expect(storedDoc.type).toBeTruthy();
            expect(Array.isArray(storedDoc.interviewers)).toBe(true);
            
            // Verify optional fields have default values
            expect(typeof storedDoc.notes).toBe('string'); // Should be empty string
            expect(typeof storedDoc.meetingDetails).toBe('object');
            expect(storedDoc.meetingDetails.link === null || typeof storedDoc.meetingDetails.link === 'string').toBe(true);
            expect(storedDoc.meetingDetails.location === null || typeof storedDoc.meetingDetails.location === 'string').toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('preserves optional field values when provided', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.record({
            ...completeInterviewDataGen().constraints,
            notes: fc.string({ minLength: 1, maxLength: 100 }),
            meetingLink: fc.webUrl(),
            location: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async (interviewData) => {
            // Property: Provided optional fields should be preserved
            const interviewDoc = createInterviewDocument(interviewData);
            
            const collection = await getInterviewsCollection();
            const result = await collection.insertOne(interviewDoc);
            testInterviewIds.push(result.insertedId.toString());
            
            const storedDoc = await collection.findOne({ _id: result.insertedId });
            
            // Verify optional fields are preserved
            expect(storedDoc.notes).toBe(interviewData.notes.trim());
            expect(storedDoc.meetingDetails.link).toBe(interviewData.meetingLink.trim());
            expect(storedDoc.meetingDetails.location).toBe(interviewData.location.trim());
          }
        ),
        { numRuns: 10 }
      );
    });

    test('handles null and empty optional fields consistently', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.record({
            ...minimalInterviewDataGen().constraints,
            notes: fc.constantFrom('', null, undefined, '   '),
            meetingLink: fc.constantFrom('', null, undefined, '   '),
            location: fc.constantFrom('', null, undefined, '   ')
          }),
          async (interviewData) => {
            // Property: Null/empty optional fields should be handled consistently
            const interviewDoc = createInterviewDocument(interviewData);
            
            const collection = await getInterviewsCollection();
            const result = await collection.insertOne(interviewDoc);
            testInterviewIds.push(result.insertedId.toString());
            
            const storedDoc = await collection.findOne({ _id: result.insertedId });
            
            // Verify empty/null values are normalized
            expect(storedDoc.notes).toBe(''); // Should be empty string, not null
            expect(storedDoc.meetingDetails.link === null || storedDoc.meetingDetails.link === '').toBe(true);
            expect(storedDoc.meetingDetails.location === null || storedDoc.meetingDetails.location === '').toBe(true);
            
            // Verify document is still valid and retrievable
            const formattedDoc = formatInterviewForDisplay(storedDoc);
            expect(formattedDoc.id).toBeTruthy();
            expect(formattedDoc.candidateName).toBeTruthy();
            expect(formattedDoc.jobTitle).toBeTruthy();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('optional field updates preserve data integrity', () => {
      return fc.assert(
        fc.asyncProperty(
          minimalInterviewDataGen(),
          fc.record({
            notes: fc.string({ minLength: 1, maxLength: 100 }),
            meetingLink: fc.webUrl(),
            location: fc.string({ minLength: 1, maxLength: 50 })
          }),
          async (initialData, updateData) => {
            // Property: Updating optional fields should preserve data integrity
            const initialDoc = createInterviewDocument(initialData);
            
            const collection = await getInterviewsCollection();
            const result = await collection.insertOne(initialDoc);
            testInterviewIds.push(result.insertedId.toString());
            
            // Update with optional fields
            await collection.updateOne(
              { _id: result.insertedId },
              {
                $set: {
                  notes: updateData.notes,
                  'meetingDetails.link': updateData.meetingLink,
                  'meetingDetails.location': updateData.location,
                  'metadata.updatedAt': new Date()
                }
              }
            );
            
            const updatedDoc = await collection.findOne({ _id: result.insertedId });
            
            // Verify required fields unchanged
            expect(updatedDoc.candidateId).toEqual(initialDoc.candidateId);
            expect(updatedDoc.jobId).toEqual(initialDoc.jobId);
            expect(updatedDoc.candidateName).toBe(initialDoc.candidateName);
            expect(updatedDoc.jobTitle).toBe(initialDoc.jobTitle);
            expect(updatedDoc.type).toBe(initialDoc.type);
            
            // Verify optional fields updated
            expect(updatedDoc.notes).toBe(updateData.notes);
            expect(updatedDoc.meetingDetails.link).toBe(updateData.meetingLink);
            expect(updatedDoc.meetingDetails.location).toBe(updateData.location);
            
            // Verify metadata updated
            expect(updatedDoc.metadata.updatedAt.getTime()).toBeGreaterThan(updatedDoc.metadata.createdAt.getTime());
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});