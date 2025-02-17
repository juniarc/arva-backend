from flask import jsonify, request, Blueprint
from models.tag_product import TagProductAssociation
from models.products import Product
from models.tags import Tag
from models.category import Category
from models.variant import Variant
from models.discount import Discount
from models.shops import Shop
from models.rating import Rating    
from models.image_product import ImageProduct
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db



tag_product_bp = Blueprint('tag_product_controller', __name__)

@tag_product_bp.route('/alltagproduct', methods=['GET'])
def get_all_tag_product():
    try:
        tag_products = db.session.query(TagProductAssociation).all()
        return jsonify([tag_product.to_dict() for tag_product in tag_products]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all tag products'}), 500


@tag_product_bp.route('/gettagbyproductid/<int:product_id>', methods=['GET'])
def get_tag_by_productid(product_id):
    try:
        tags_product = db.session.query(TagProductAssociation).filter_by(product_id=product_id).all()
        tags_product = [tag_product.tag for tag_product in tags_product]
        return jsonify([tag.to_dict() for tag in tags_product]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get tag {e}'}), 500

@tag_product_bp.route('/getproductbytagid/<int:tag_id>', methods=['GET'])
def get_product_by_tagid(tag_id):
    try:
        products = db.session.query(TagProductAssociation).filter_by(tag_id=tag_id).all()
        return jsonify([product.to_dict() for product in products]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get product by tag id'}), 500

  
@tag_product_bp.route('/getproductbytagname/<string:tag_name>', methods=['GET'])
def get_product_by_tag_name(tag_name):
    lower_tag_name = tag_name.lower()
    product_list = []
    try:
        tag = db.session.query(Tag).filter_by(tag_name=lower_tag_name).first()
        if tag is None:
            return jsonify({'error': 'Tag not found'}), 404
        tag_id = tag.tag_id
        
        product_tags = db.session.query(TagProductAssociation).filter_by(tag_id=tag_id).all()

        for element in product_tags:
            product = db.session.query(Product).filter_by(product_id=element.product_id).first()
            if product.status != 'active':
                continue
            category_name = product.category.category_name
            variant = db.session.query(Variant).filter_by(product_id=product.product_id).all()
            image_product = db.session.query(ImageProduct).filter_by(product_id=product.product_id).all()
            shop_id = product.shop_id
            shop_name = product.shop.shop_name
            shop_address_city = product.shop.shop_address_city
            discounts =  db.session.query(Discount).filter_by(product_id=product.product_id).all()
            ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product.product_id).scalar()

            discount_list= []
            variants = []
            images = []

            for discount in discounts:
                discount_list.append(discount.to_dict())

            if image_product:
                for image in image_product:

                    image = image.image_data
                    images.append(image)
            
            if variant:
                for v in variant:
                    v = {
                        'variant_id': v.variant_id,
                        'variant_name': v.variant_name,
                        'variant_price': v.price,
                        'variant_stock': v.stock,
                        'variant_unit': v.unit
                    }
                    variants.append(v)

            product_list.append({
                'product_id': product.product_id,
                'product_name': product.product_name,
                'description': product.description,
                'product_type': product.product_type,
                'shipping_cost': product.shipping_cost,
                'sold': product.sold,
                'created_at': product.created_at,
                'status': product.status,
                'category': category_name,
                'image': images,
                'variant': variants,
                'discount': discount_list,
                'ratings': ratings,
                'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city, 'shop_name':product.shop.shop_name},
            })

        return jsonify( product_list), 200
            
    except Exception as e:
        return jsonify({'error': f'Failed to get product by tag name {e}'}), 500
    
@tag_product_bp.route('/createtagproduct/<int:product_id>', methods=['POST'])
@jwt_required()
def create_tag_product(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'tag_id' not in data:
        return jsonify({'error': 'Missing tag id'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        
        product_tag = db.session.query(TagProductAssociation).filter_by(product_id=product_id,tag_id=data['tag_id']).first()
        if product_tag:
            return jsonify({'error': 'Product with tag already exist'}),400

        tag = db.session.query(Tag).filter_by(tag_id=data['tag_id']).first()
        if tag is None:
            return jsonify({'error': f'Tag with id {data['tag_id']} not found'})
        new_tag_product = TagProductAssociation(tag_id=data['tag_id'], product_id=product_id)
        db.session.add(new_tag_product)
        db.session.commit()
        return jsonify({'message': 'Tag product created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create tag product'}), 500
    

@tag_product_bp.route('updatetagproduct/<int:product_id>/<int:tag_id>', methods=['PUT'])
@jwt_required()
def update_tag_product(product_id,tag_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data Provided'}), 400
    if 'tag_id' not in data:
        return jsonify({'error': 'Missing tag id'}), 400

    try:
        tag_product = db.session.query(TagProductAssociation).filter_by(product_id=product_id,tag_id=tag_id).first()
        if tag_product is None:
            return jsonify({'error': 'Product with tag no found'}), 404
        
        tag = db.session.query(Tag).filter_by(tag_id=data['tag_id']).first()
        if tag is None:
            return jsonify({'error': f'Tag with id {data['tag_id']} not found'})
        
        tag_product_exist = db.session.query(TagProductAssociation).filter_by(product_id=product_id,tag_id=data['tag_id']).first()
        if tag_product_exist:
            return jsonify({'error': 'Product with tag already exist'}), 400
        
        product = db.session.query(Product).filter_by(user_id=current_user_id).first()
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized : Insufficient Permission'}), 400
        tag_product.tag_id = data.get('tag_id',tag_product.tag_id)
        db.session.commit()
        return jsonify({"message": "Update tag product successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update {e}'}), 500
    
@tag_product_bp.route('/deletetagproduct/<int:product_id>/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def delete_tag_product(product_id,tag_id):
    current_user_id = int(get_jwt_identity())

    try:
        tag_product = db.session.query(TagProductAssociation).filter_by(product_id=product_id,tag_id=tag_id).first()
        if tag_product is None:
            return jsonify({'error': 'Product with tag not found'}), 404
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        db.session.delete(tag_product)
        db.session.commit()
        return jsonify({'message': 'Tag product deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete tag product'}), 500
    